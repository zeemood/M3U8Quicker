import type { DownloadTaskSegmentState } from "../types";

export type SegmentStatusFilter = "completed" | "failed" | "incomplete";

type SegmentStateLike = Pick<
  DownloadTaskSegmentState,
  "total_segments" | "completed_segment_indices" | "failed_segment_indices"
>;

export function getSegmentStatus(
  segmentNumber: number,
  completed: ReadonlySet<number>,
  failed: ReadonlySet<number>
): SegmentStatusFilter {
  if (completed.has(segmentNumber)) {
    return "completed";
  }
  if (failed.has(segmentNumber)) {
    return "failed";
  }
  return "incomplete";
}

export function countSegmentStatuses(
  segmentState: SegmentStateLike
): Record<SegmentStatusFilter, number> {
  const completed = new Set(segmentState.completed_segment_indices);
  const failed = new Set(segmentState.failed_segment_indices);
  const counts: Record<SegmentStatusFilter, number> = {
    completed: 0,
    failed: 0,
    incomplete: 0,
  };

  for (let segmentNumber = 1; segmentNumber <= segmentState.total_segments; segmentNumber += 1) {
    counts[getSegmentStatus(segmentNumber, completed, failed)] += 1;
  }

  return counts;
}

export function getVisibleSegmentNumbers(
  segmentState: SegmentStateLike,
  filter: SegmentStatusFilter | null
): number[] {
  if (!filter) {
    return Array.from(
      { length: segmentState.total_segments },
      (_, index) => index + 1
    );
  }

  const completed = new Set(segmentState.completed_segment_indices);
  const failed = new Set(segmentState.failed_segment_indices);
  return Array.from(
    { length: segmentState.total_segments },
    (_, index) => index + 1
  ).filter(
    (segmentNumber) =>
      getSegmentStatus(segmentNumber, completed, failed) === filter
  );
}
