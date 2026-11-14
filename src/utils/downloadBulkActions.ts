import type { DownloadTaskSummary } from "../types";

export type BulkDownloadAction = "resume" | "pause";

export function selectBulkDownloadIds(
  tasks: ReadonlyArray<Pick<DownloadTaskSummary, "id" | "status" | "is_live">>,
  action: BulkDownloadAction
): string[] {
  const targetStatus = action === "resume" ? "Paused" : "Downloading";

  return tasks
    .filter((task) => !task.is_live && task.status === targetStatus)
    .map((task) => task.id);
}
