import type { DownloadTaskSegmentState } from "../types";
import {
  getSegmentStatus,
  getVisibleSegmentNumbers,
  type SegmentStatusFilter,
} from "../utils/segmentFilters";

interface DownloadSegmentGridProps {
  segmentState: DownloadTaskSegmentState;
  filterStatus?: SegmentStatusFilter | null;
}

export function DownloadSegmentGrid({
  segmentState,
  filterStatus = null,
}: DownloadSegmentGridProps) {
  const completedSet = new Set(segmentState.completed_segment_indices);
  const failedSet = new Set(segmentState.failed_segment_indices);
  const segmentItems = getVisibleSegmentNumbers(segmentState, filterStatus);

  return (
    <div
      className="segment-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, minmax(36px, max-content))",
        gap: 6,
        maxHeight: 220,
        overflowY: "auto",
        paddingRight: 18,
      }}
    >
      {segmentItems.map((segmentNumber) => {
        const status = getSegmentStatus(
          segmentNumber,
          completedSet,
          failedSet
        );
        const segmentClassName =
          status === "completed"
            ? "segment-chip segment-chip-completed"
            : status === "failed"
              ? "segment-chip segment-chip-failed"
              : "segment-chip segment-chip-pending";

        return (
          <div
            key={segmentNumber}
            title={segmentState.segment_errors?.[segmentNumber]}
            className={segmentClassName}
            style={{
              minWidth: 36,
              padding: "2px 8px",
              textAlign: "center",
              fontSize: 12,
              lineHeight: "20px",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {segmentNumber}
          </div>
        );
      })}
    </div>
  );
}
