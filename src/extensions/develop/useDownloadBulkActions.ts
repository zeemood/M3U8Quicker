import { Modal, message } from "antd";
import { useCallback, useRef, useState } from "react";
import { t } from "../../i18n";
import * as api from "../../services/api";
import type { DownloadGroup } from "../../types";
import {
  selectBulkDownloadIds,
  type BulkDownloadAction,
} from "../../utils/downloadBulkActions";

const BULK_ACTION_CONCURRENCY = 4;

interface DownloadBulkActionsOptions {
  refreshCounts: () => Promise<unknown>;
  refreshGroup: (group: DownloadGroup, page?: number) => Promise<unknown>;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function confirmRestartBulkDownloads(
  count: number,
  downloadedBytes: number
): Promise<boolean> {
  return new Promise((resolve) => {
    Modal.confirm({
      title: t("serverDoesNotSupportResumingDownloads"),
      content: t("bulkRestartDownloadConfirmation", {
        value0: count,
        value1: formatBytes(downloadedBytes),
      }),
      okText: t("restartDownload"),
      cancelText: t("keepPaused"),
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}

async function runWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<Array<PromiseSettledResult<R>>> {
  const results: Array<PromiseSettledResult<R>> = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= items.length) {
          return;
        }

        try {
          results[index] = {
            status: "fulfilled",
            value: await worker(items[index]),
          };
        } catch (reason) {
          results[index] = { status: "rejected", reason };
        }
      }
    })
  );

  return results;
}

export function useDownloadBulkActions({
  refreshCounts,
  refreshGroup,
}: DownloadBulkActionsOptions) {
  const [bulkAction, setBulkAction] = useState<BulkDownloadAction | null>(null);
  const bulkActionRef = useRef<BulkDownloadAction | null>(null);

  const loadAllActiveDownloads = useCallback(async () => {
    const activeCounts = await api.getDownloadCounts();
    if (activeCounts.active_count === 0) {
      return [];
    }

    const page = await api.getDownloadsPage(
      "active",
      1,
      activeCounts.active_count
    );
    return page.items;
  }, []);

  const refreshAfterBulkAction = useCallback(async () => {
    await Promise.allSettled([
      refreshCounts(),
      refreshGroup("active"),
      refreshGroup("history", 1),
    ]);
  }, [refreshCounts, refreshGroup]);

  const pauseAll = useCallback(async () => {
    if (bulkActionRef.current) {
      return;
    }
    bulkActionRef.current = "pause";
    setBulkAction("pause");

    try {
      const tasks = await loadAllActiveDownloads();
      const ids = selectBulkDownloadIds(tasks, "pause");
      if (ids.length === 0) {
        message.info(t("noDownloadingDownloadsToPause"));
        return;
      }

      const results = await runWithConcurrency(
        ids,
        BULK_ACTION_CONCURRENCY,
        (id) => api.pauseDownload(id)
      );
      const succeeded = results.filter(
        (result) => result.status === "fulfilled"
      ).length;
      const failed = results.length - succeeded;

      await refreshAfterBulkAction();

      if (failed === 0) {
        message.success(t("bulkDownloadsPaused", { value0: succeeded }));
      } else {
        message.warning(
          t("bulkDownloadsPartialFailure", {
            value0: succeeded,
            value1: failed,
          })
        );
      }
    } catch (error) {
      console.error("Failed to pause all downloads:", error);
      message.error(
        t("failedToRunBulkDownloadAction", {
          value0: error instanceof Error ? error.message : String(error),
        })
      );
    } finally {
      bulkActionRef.current = null;
      setBulkAction(null);
    }
  }, [loadAllActiveDownloads, refreshAfterBulkAction]);

  const resumeAll = useCallback(async () => {
    if (bulkActionRef.current) {
      return;
    }
    bulkActionRef.current = "resume";
    setBulkAction("resume");

    try {
      const tasks = await loadAllActiveDownloads();
      const ids = selectBulkDownloadIds(tasks, "resume");
      if (ids.length === 0) {
        message.info(t("noPausedDownloadsToResume"));
        return;
      }

      const checks = await runWithConcurrency(
        ids,
        BULK_ACTION_CONCURRENCY,
        async (id) => ({
          id,
          check: await api.checkResumeDownload(id),
        })
      );
      const restartDownloads: Array<{
        id: string;
        downloadedBytes: number;
      }> = [];
      let checkFailed = 0;

      for (const result of checks) {
        if (result.status === "rejected") {
          checkFailed += 1;
          continue;
        }
        if (result.value.check.action === "confirm_restart") {
          restartDownloads.push({
            id: result.value.id,
            downloadedBytes: result.value.check.downloaded_bytes,
          });
        }
      }

      const restartConfirmed =
        restartDownloads.length === 0 ||
        (await confirmRestartBulkDownloads(
          restartDownloads.length,
          restartDownloads.reduce(
            (total, download) => total + download.downloadedBytes,
            0
          )
        ));
      const resumeTargets: Array<{ id: string; restartConfirmed: boolean }> = [];
      let skipped = 0;

      for (const result of checks) {
        if (result.status === "rejected") {
          continue;
        }
        if (result.value.check.action === "confirm_restart") {
          if (!restartConfirmed) {
            skipped += 1;
            continue;
          }
          resumeTargets.push({
            id: result.value.id,
            restartConfirmed: true,
          });
          continue;
        }
        resumeTargets.push({
          id: result.value.id,
          restartConfirmed: false,
        });
      }

      const resumeResults = await runWithConcurrency(
        resumeTargets,
        BULK_ACTION_CONCURRENCY,
        ({ id, restartConfirmed: confirmed }) =>
          api.resumeDownload(id, confirmed)
      );
      const succeeded = resumeResults.filter(
        (result) => result.status === "fulfilled"
      ).length;
      const failed = resumeResults.length - succeeded + checkFailed;

      await refreshAfterBulkAction();

      if (failed > 0) {
        message.warning(
          t("bulkDownloadsPartialFailure", {
            value0: succeeded,
            value1: failed,
          })
        );
      } else if (succeeded > 0) {
        message.success(
          t("bulkDownloadsResumeStarted", { value0: succeeded })
        );
      } else if (skipped > 0) {
        message.info(t("bulkResumeCancelled"));
      }
    } catch (error) {
      console.error("Failed to start all downloads:", error);
      message.error(
        t("failedToRunBulkDownloadAction", {
          value0: error instanceof Error ? error.message : String(error),
        })
      );
    } finally {
      bulkActionRef.current = null;
      setBulkAction(null);
    }
  }, [loadAllActiveDownloads, refreshAfterBulkAction]);

  return { pauseAll, resumeAll, bulkAction };
}
