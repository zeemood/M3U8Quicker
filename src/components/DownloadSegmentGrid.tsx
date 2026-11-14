import type { DownloadTaskSegmentState } from "../types";

interface DownloadSegmentGridProps {
  segmentState: DownloadTaskSegmentState;
}

export function DownloadSegmentGrid({
  segmentState,
}: DownloadSegmentGridProps) {
  const completedSet = new Set(segmentState.completed_segment_indices);
  const failedSet = new Set(segmentState.failed_segment_indices);
  const segmentItems = Array.from(
    { length: segmentState.total_segments },
    (_, index) => index + 1
  );

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
        const completed = completedSet.has(segmentNumber);
        const failed = failedSet.has(segmentNumber);
        const segmentClassName = completed
          ? "segment-chip segment-chip-completed"
          : failed
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
