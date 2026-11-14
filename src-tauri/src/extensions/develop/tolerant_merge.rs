use std::collections::BTreeSet;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use crate::downloader::{
    convert_fmp4_segments_to_mp4,
    convert_ts_to_mp4_file,
    ensure_extension,
    hls_init_segment_file_path,
    merge_selected_segments,
    mp4_partial_path_for_output_path,
    resolve_available_output_path,
    segment_file_path_for_kind,
    temp_dir_for_task,
    write_fmp4_local_playlist,
};
use crate::error::AppError;
use crate::models::{DownloadTask, FileType, HlsMediaKind, HlsOutputMode, SegmentInfo};

pub(crate) fn available_segment_indices(
    total_segments: usize,
    completed_segment_indices: &[usize],
    failed_segment_indices: &[usize],
) -> Vec<usize> {
    let failed = failed_segment_indices
        .iter()
        .copied()
        .collect::<std::collections::BTreeSet<_>>();
    completed_segment_indices
        .iter()
        .copied()
        .filter(|index| {
            *index > 0 && *index <= total_segments && !failed.contains(index)
        })
        .collect::<std::collections::BTreeSet<_>>()
        .into_iter()
        .collect()
}

pub(crate) fn validate_tolerant_merge_task(
    file_type: FileType,
    output_mode: HlsOutputMode,
    completed_segments: usize,
    failed_segments: usize,
    limit: usize,
) -> Result<(), AppError> {
    if file_type != FileType::Hls || output_mode != HlsOutputMode::SingleStream {
        return Err(AppError::InvalidInput(
            crate::i18n::tr("tolerantMergeUnavailable").to_string(),
        ));
    }
    if limit == 0 || completed_segments == 0 || failed_segments == 0 || failed_segments > limit {
        return Err(AppError::InvalidInput(
            crate::i18n::tr("tolerantMergeUnavailable").to_string(),
        ));
    }
    Ok(())
}

async fn remove_file_if_exists(path: &Path) -> Result<(), AppError> {
    match tokio::fs::remove_file(path).await {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.into()),
    }
}

pub(crate) fn resolve_effective_ffmpeg_path<'a>(
    ffmpeg_enabled: bool,
    ffmpeg_path: Option<&'a Path>,
) -> Option<&'a Path> {
    if ffmpeg_enabled { ffmpeg_path } else { None }
}

pub(crate) async fn merge_single_stream_with_failed_segments(
    task: &DownloadTask,
    convert_to_mp4: bool,
    ffmpeg_enabled: bool,
    ffmpeg_path: Option<&Path>,
) -> Result<PathBuf, AppError> {
    let output_dir = PathBuf::from(&task.output_dir);
    let temp_dir = temp_dir_for_task(&output_dir, &task.id);
    let effective_ffmpeg_path = resolve_effective_ffmpeg_path(ffmpeg_enabled, ffmpeg_path);
    let final_output_path = match task.hls_media_kind {
        HlsMediaKind::MpegTs => resolve_available_output_path(
            &output_dir,
            &ensure_extension(&task.filename, "ts"),
        ),
        HlsMediaKind::Fmp4 => resolve_available_output_path(
            &output_dir,
            &ensure_extension(&task.filename, "mp4"),
        ),
    };
    let partial_output_path = mp4_partial_path_for_output_path(&final_output_path);
    remove_file_if_exists(&partial_output_path).await?;

    let available_one_based = available_segment_indices(
        task.total_segments,
        &task.completed_segment_indices,
        &task.failed_segment_indices,
    );
    let mut existing_one_based = BTreeSet::new();
    for index in available_one_based {
        let path = segment_file_path_for_kind(&temp_dir, task.hls_media_kind, index - 1);
        if tokio::fs::metadata(&path)
            .await
            .map(|metadata| metadata.is_file())
            .unwrap_or(false)
        {
            existing_one_based.insert(index);
        }
    }
    if existing_one_based.is_empty() {
        return Err(AppError::InvalidInput(
            crate::i18n::tr("tolerantMergeUnavailable").to_string(),
        ));
    }

    if task.hls_media_kind == HlsMediaKind::MpegTs {
        let zero_based = existing_one_based
            .iter()
            .map(|index| index - 1)
            .collect::<Vec<_>>();
        if let Err(error) =
            merge_selected_segments(&temp_dir, &zero_based, &partial_output_path).await
        {
            let _ = remove_file_if_exists(&partial_output_path).await;
            return Err(error);
        }
        if let Err(error) = tokio::fs::rename(&partial_output_path, &final_output_path).await {
            let _ = remove_file_if_exists(&partial_output_path).await;
            return Err(error.into());
        }
        if !convert_to_mp4 {
            return Ok(final_output_path);
        }
        let mp4_path = resolve_available_output_path(
            &output_dir,
            &ensure_extension(&task.filename, "mp4"),
        );
        let mp4_partial_path = mp4_partial_path_for_output_path(&mp4_path);
        remove_file_if_exists(&mp4_partial_path).await?;
        if let Err(error) = convert_ts_to_mp4_file(
            &final_output_path,
            &mp4_partial_path,
            false,
            ffmpeg_enabled,
            effective_ffmpeg_path,
        )
        .await
        {
            let _ = remove_file_if_exists(&mp4_partial_path).await;
            eprintln!(
                "[downloader] TS to MP4 conversion failed, keeping TS output: {}",
                error
            );
            return Ok(final_output_path);
        }
        if let Err(error) = tokio::fs::rename(&mp4_partial_path, &mp4_path).await {
            let _ = remove_file_if_exists(&mp4_partial_path).await;
            return Err(error.into());
        }
        let _ = tokio::fs::remove_file(&final_output_path).await;
        return Ok(mp4_path);
    }

    let required_metadata_len = existing_one_based
        .iter()
        .next_back()
        .copied()
        .unwrap_or_default();
    if task.segment_uris.len() < required_metadata_len
        || task.segment_durations.len() < required_metadata_len
        || task.segment_init_indices.len() < required_metadata_len
    {
        return Err(AppError::InvalidInput(
            crate::i18n::tr("tolerantMergeUnavailable").to_string(),
        ));
    }

    let mut selected = Vec::with_capacity(existing_one_based.len());
    for one_based_index in existing_one_based {
        let index = one_based_index - 1;
        let uri = task.segment_uris[index].clone();
        let duration = task.segment_durations[index];
        let init_segment_index = task.segment_init_indices[index];
        selected.push(SegmentInfo {
            index,
            uri,
            duration,
            sequence_number: index as u64,
            byte_range: None,
            init_segment_index,
            encryption: None,
        });
    }

    let mut validated_init_indices = BTreeSet::new();
    for segment in &selected {
        let Some(init_index) = segment.init_segment_index else {
            continue;
        };
        if !validated_init_indices.insert(init_index) {
            continue;
        }
        let init = task
            .hls_init_segments
            .iter()
            .find(|init| init.index == init_index)
            .ok_or_else(|| {
                AppError::Internal(format!(
                    "Missing fMP4 init segment metadata for index {}",
                    init_index
                ))
            })?;
        let init_path = hls_init_segment_file_path(&temp_dir, init.index);
        if !tokio::fs::metadata(&init_path)
            .await
            .map(|metadata| metadata.is_file())
            .unwrap_or(false)
        {
            return Err(AppError::InvalidInput(
                crate::i18n::tr("tolerantMergeUnavailable").to_string(),
            ));
        }
    }

    write_fmp4_local_playlist(&temp_dir, &task.hls_init_segments, &selected).await?;
    if let Err(error) = convert_fmp4_segments_to_mp4(
        &temp_dir,
        &task.hls_init_segments,
        &selected,
        &partial_output_path,
        effective_ffmpeg_path,
    )
    .await
    {
        let _ = remove_file_if_exists(&partial_output_path).await;
        return Err(error);
    }
    if let Err(error) = tokio::fs::rename(&partial_output_path, &final_output_path).await {
        let _ = remove_file_if_exists(&partial_output_path).await;
        return Err(error.into());
    }
    Ok(final_output_path)
}
