import type { DownloadTaskSummary } from "../types";

type TolerantMergeTask = Pick<
  DownloadTaskSummary,
  | "file_type"
  | "hls_output_mode"
  | "status"
  | "is_live"
  | "total_segments"
  | "completed_segments"
  | "failed_segment_count"
>;

export function canMergeWithFailedSegments(
  task: TolerantMergeTask,
  failedSegmentLimit: number
): boolean {
  if (
    task.is_live ||
    task.file_type !== "hls" ||
    task.hls_output_mode !== "single_stream" ||
    task.total_segments <= 0 ||
    task.failed_segment_count <= 0 ||
    failedSegmentLimit <= 0 ||
    task.failed_segment_count > failedSegmentLimit
  ) {
    return false;
  }

  const finishedProcessing =
    task.completed_segments + task.failed_segment_count >= task.total_segments;
  const isPaused = task.status === "Paused";
  const isFailed =
    typeof task.status === "object" && "Failed" in task.status;

  return finishedProcessing && (isPaused || isFailed);
}
