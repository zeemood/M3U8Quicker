use chrono::Utc;
use tauri::{AppHandle, Emitter, State};

use crate::commands::{
    get_or_load_task, maybe_cleanup_completed_temp_dir, task_to_progress,
};
use crate::error::AppError;
use crate::models::{DownloadStatus, DownloadTaskSummary};
use crate::persistence;
use crate::state::AppState;
use super::tolerant_merge::{
    merge_single_stream_with_failed_segments, validate_tolerant_merge_task,
};

#[tauri::command]
pub async fn merge_download_with_failed_segments(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<DownloadTaskSummary, AppError> {
    let task = get_or_load_task(&app_handle, &state, &id).await?;
    let settings = persistence::load_settings(&app_handle).await;
    let has_running_token = state.cancel_tokens.lock().await.contains_key(&id);
    validate_tolerant_merge_task(
        task.file_type,
        task.hls_output_mode,
        task.completed_segment_indices.len(),
        task.failed_segment_indices.len(),
        settings.merge_failed_segment_limit,
    )?;

    let convert_to_mp4 = *state.convert_to_mp4.lock().await;
    let ffmpeg_enabled = *state.ffmpeg_enabled.lock().await;
    let merging_task = {
        let mut downloads = state.downloads.lock().await;
        downloads.entry(id.clone()).or_insert_with(|| task.clone());
        let current = downloads
            .get_mut(&id)
            .ok_or_else(|| AppError::InvalidInput(format!("Download {} not found", id)))?;
        if !matches!(
            current.status,
            DownloadStatus::Downloading | DownloadStatus::Paused | DownloadStatus::Failed(_)
        ) {
            return Err(AppError::InvalidInput(
                crate::i18n::tr("tolerantMergeUnavailable").to_string(),
            ));
        }
        validate_tolerant_merge_task(
            current.file_type,
            current.hls_output_mode,
            current.completed_segment_indices.len(),
            current.failed_segment_indices.len(),
            settings.merge_failed_segment_limit,
        )?;

        current.status = DownloadStatus::Merging;
        current.speed_bytes_per_sec = 0;
        current.file_path = None;
        current.touch();
        current.clone()
    };

    let ffmpeg_path = if ffmpeg_enabled {
        crate::ffmpeg::resolve_ffmpeg_path(&app_handle).await
    } else {
        None
    };

    persistence::save_task(&app_handle, &merging_task).await?;
    let _ = app_handle.emit("download-progress", task_to_progress(&merging_task));
    if has_running_token {
        if let Some(token) = state.cancel_tokens.lock().await.get(&id).cloned() {
            token.cancel();
            wait_for_download_worker_to_stop(&state, &id).await?;
        }
    }

    let merge_result = merge_single_stream_with_failed_segments(
        &merging_task,
        convert_to_mp4,
        ffmpeg_enabled,
        ffmpeg_path.as_deref(),
    )
    .await;

    let updated_task = {
        let mut downloads = state.downloads.lock().await;
        let current = downloads
            .get_mut(&id)
            .ok_or_else(|| AppError::InvalidInput(format!("Download {} not found", id)))?;
        let completed_at = Utc::now();
        current.speed_bytes_per_sec = 0;
        current.updated_at = Some(completed_at);

        match &merge_result {
            Ok(final_path) => {
                current.status = DownloadStatus::Completed;
                current.completed_at = Some(completed_at);
                current.file_path = Some(final_path.to_string_lossy().to_string());
                if let Ok(metadata) = final_path.metadata() {
                    if metadata.is_file() {
                        current.total_bytes = metadata.len();
                    }
                }
            }
            Err(error) => {
                current.status = DownloadStatus::Failed(error.to_string());
            }
        }

        current.clone()
    };

    persistence::save_task(&app_handle, &updated_task).await?;
    let _ = app_handle.emit("download-progress", task_to_progress(&updated_task));
    if merge_result.is_ok() {
        maybe_cleanup_completed_temp_dir(&app_handle, &state, &id).await;
    }
    if should_remove_download_from_runtime(&updated_task.status) {
        state.downloads.lock().await.remove(&id);
    }

    match merge_result {
        Ok(_) => Ok(persistence::task_to_summary(&updated_task)),
        Err(error) => Err(error),
    }
}

fn should_remove_download_from_runtime(status: &DownloadStatus) -> bool {
    matches!(
        status,
        DownloadStatus::Completed | DownloadStatus::Failed(_) | DownloadStatus::Cancelled
    )
}

async fn wait_for_download_worker_to_stop(
    state: &AppState,
    id: &str,
) -> Result<(), AppError> {
    for _ in 0..300 {
        if !state.cancel_tokens.lock().await.contains_key(id) {
            return Ok(());
        }
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }

    Err(AppError::InvalidInput(
        crate::i18n::tr("tolerantMergeUnavailable").to_string(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn terminal_downloads_are_removed_from_runtime_collection() {
        assert!(should_remove_download_from_runtime(
            &DownloadStatus::Completed
        ));
        assert!(should_remove_download_from_runtime(&DownloadStatus::Failed(
            "merge failed".to_string()
        )));
        assert!(!should_remove_download_from_runtime(
            &DownloadStatus::Merging
        ));
    }
}
