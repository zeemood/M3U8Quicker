use chrono::Utc;
use tauri::{AppHandle, Emitter, State};

use super::tolerant_merge::{
    merge_single_stream_with_failed_segments, validate_tolerant_merge_task,
};
use crate::commands::{get_or_load_task, maybe_cleanup_completed_temp_dir, task_to_progress};
use crate::error::AppError;
use crate::models::{DownloadStatus, DownloadTask, DownloadTaskSummary};
use crate::persistence;
use crate::state::AppState;

#[tauri::command]
pub async fn merge_download_with_failed_segments(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<DownloadTaskSummary, AppError> {
    let task = get_or_load_task(&app_handle, &state, &id).await?;
    let settings = persistence::load_settings(&app_handle).await;
    validate_tolerant_merge_task(
        task.file_type,
        task.hls_output_mode,
        task.completed_segment_indices.len(),
        task.failed_segment_indices.len(),
        settings.merge_failed_segment_limit,
    )?;

    let convert_to_mp4 = *state.convert_to_mp4.lock().await;
    let ffmpeg_enabled = *state.ffmpeg_enabled.lock().await;
    let (merging_task, original_file_path) = {
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

        let original_file_path = current.file_path.clone();
        current.status = DownloadStatus::Merging;
        current.speed_bytes_per_sec = 0;
        current.file_path = None;
        current.touch();
        (current.clone(), original_file_path)
    };

    let ffmpeg_path = if ffmpeg_enabled {
        crate::ffmpeg::resolve_ffmpeg_path(&app_handle).await
    } else {
        None
    };

    if let Err(error) = persistence::save_task(&app_handle, &merging_task).await {
        rollback_merge_start_failure(&app_handle, &state, &id, original_file_path.clone()).await;
        return Err(error);
    }
    let _ = app_handle.emit("download-progress", task_to_progress(&merging_task));
    if let Err(error) = cancel_running_download_worker(&state, &id).await {
        rollback_merge_start_failure(&app_handle, &state, &id, original_file_path).await;
        return Err(error);
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

fn restore_task_after_merge_start_failure(
    task: &mut DownloadTask,
    original_file_path: Option<String>,
) {
    task.status = DownloadStatus::Paused;
    task.speed_bytes_per_sec = 0;
    task.file_path = original_file_path;
    task.touch();
}

async fn rollback_merge_start_failure(
    app_handle: &AppHandle,
    state: &AppState,
    id: &str,
    original_file_path: Option<String>,
) {
    let task = {
        let mut downloads = state.downloads.lock().await;
        downloads.get_mut(id).map(|task| {
            restore_task_after_merge_start_failure(task, original_file_path);
            task.clone()
        })
    };

    if let Some(task) = task {
        if let Err(error) = persistence::save_task(app_handle, &task).await {
            eprintln!(
                "[tolerant_merge] failed to persist rollback for task {}: {}",
                id, error
            );
        }
        let _ = app_handle.emit("download-progress", task_to_progress(&task));
    }
}

async fn cancel_running_download_worker(state: &AppState, id: &str) -> Result<(), AppError> {
    let token = {
        let cancel_tokens = state.cancel_tokens.lock().await;
        cancel_tokens.get(id).cloned()
    };
    if let Some(token) = token {
        token.cancel();
        wait_for_download_worker_to_stop(state, id).await?;
    }
    Ok(())
}

async fn wait_for_download_worker_to_stop(state: &AppState, id: &str) -> Result<(), AppError> {
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
    use crate::models::DownloadTask;
    use tokio_util::sync::CancellationToken;

    fn merging_task() -> DownloadTask {
        serde_json::from_value(serde_json::json!({
            "id": "task-1",
            "url": "https://example.com/video.m3u8",
            "filename": "video",
            "output_dir": "D:\\downloads",
            "status": "Merging",
            "total_segments": 2,
            "completed_segments": 1,
            "total_bytes": 1024,
            "speed_bytes_per_sec": 2048,
            "created_at": "2026-01-01T00:00:00Z",
            "completed_at": null,
            "file_path": null
        }))
        .expect("valid download task")
    }

    #[test]
    fn merge_start_failure_restores_paused_state_and_file_path() {
        let mut task = merging_task();
        let original_file_path = Some("D:\\downloads\\partial.ts".to_string());

        restore_task_after_merge_start_failure(&mut task, original_file_path.clone());

        assert_eq!(task.status, DownloadStatus::Paused);
        assert_eq!(task.speed_bytes_per_sec, 0);
        assert_eq!(task.file_path, original_file_path);
    }

    #[tokio::test]
    async fn cancelling_worker_releases_token_lock_while_waiting() {
        let state = AppState::new(std::env::temp_dir().to_string_lossy().to_string());
        state
            .cancel_tokens
            .lock()
            .await
            .insert("task-1".to_string(), CancellationToken::new());
        let cancel_tokens = state.cancel_tokens.clone();
        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
            cancel_tokens.lock().await.remove("task-1");
        });

        let result = tokio::time::timeout(
            std::time::Duration::from_secs(1),
            cancel_running_download_worker(&state, "task-1"),
        )
        .await
        .expect("cancellation must not hold the token map lock while waiting");

        result.expect("worker cancellation should complete");
    }

    #[test]
    fn terminal_downloads_are_removed_from_runtime_collection() {
        assert!(should_remove_download_from_runtime(
            &DownloadStatus::Completed
        ));
        assert!(should_remove_download_from_runtime(
            &DownloadStatus::Failed("merge failed".to_string())
        ));
        assert!(!should_remove_download_from_runtime(
            &DownloadStatus::Merging
        ));
    }
}
