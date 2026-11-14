import { t, useTranslation } from "../i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { message } from "antd";
import type {
  CreateLiveRecordParams,
  LiveGroup,
  LiveProgressEvent,
  LiveRecordCounts,
  LiveRecordPage,
  LiveRecordSummary,
} from "../types";
import * as api from "../services/api";
import { createProgressBatcher } from "../utils/progressBatcher";

const DEFAULT_PAGE_SIZE = 50;
const PROGRESS_FLUSH_INTERVAL_MS = 250;

interface PageState {
  items: LiveRecordSummary[];
  total: number;
  page: number;
  pageSize: number;
}

const INITIAL_PAGE_STATE: PageState = {
  items: [],
  total: 0,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

function toPageState(page: LiveRecordPage): PageState {
  return {
    items: page.items,
    total: page.total,
    page: page.page,
    pageSize: page.page_size,
  };
}

function patchPageItem(
  page: PageState,
  event: LiveProgressEvent
): { nextPage: PageState; found: boolean } {
  let found = false;
  const items = page.items.map((item) => {
    if (item.id !== event.id) {
      return item;
    }
    found = true;
    return {
      ...item,
      status: event.status,
      total_bytes: event.total_bytes,
      speed_bytes_per_sec: event.speed_bytes_per_sec,
      duration_ms: event.duration_ms,
      updated_at: event.updated_at,
    };
  });
  return {
    nextPage: found ? { ...page, items } : page,
    found,
  };
}

export function useLiveRecords(historyPageSize = DEFAULT_PAGE_SIZE) {
  useTranslation();
  const [counts, setCounts] = useState<LiveRecordCounts>({
    active_count: 0,
    history_count: 0,
  });
  const [activePage, setActivePage] = useState<PageState>(INITIAL_PAGE_STATE);
  const [historyPage, setHistoryPage] = useState<PageState>(INITIAL_PAGE_STATE);
  const [loadingGroups, setLoadingGroups] = useState<Record<LiveGroup, boolean>>({
    active: true,
    history: true,
  });
  const activePageRef = useRef(activePage);
  const historyPageRef = useRef(historyPage);
  const historyRequestIdRef = useRef(0);

  useEffect(() => {
    activePageRef.current = activePage;
  }, [activePage]);

  useEffect(() => {
    historyPageRef.current = historyPage;
  }, [historyPage]);

  const refreshCounts = useCallback(async () => {
    const next = await api.getLiveRecordCounts();
    setCounts(next);
    return next;
  }, []);

  const refreshGroup = useCallback(
    async (group: LiveGroup, page?: number) => {
      setLoadingGroups((prev) => ({ ...prev, [group]: true }));
      try {
        const currentPage =
          group === "active" ? activePageRef.current : historyPageRef.current;
        const pageSize =
          group === "history" ? historyPageSize : currentPage.pageSize;
        const next = await api.getLiveRecordsPage(
          group,
          page ?? currentPage.page,
          pageSize
        );
        const nextState = toPageState(next);
        if (group === "active") {
          activePageRef.current = nextState;
          setActivePage(nextState);
        } else {
          historyPageRef.current = nextState;
          setHistoryPage(nextState);
        }
      } finally {
        setLoadingGroups((prev) => ({ ...prev, [group]: false }));
      }
    },
    [historyPageSize]
  );

  useEffect(() => {
    let disposed = false;
    const initialize = async () => {
      try {
        const [nextCounts, active] = await Promise.all([
          api.getLiveRecordCounts(),
          api.getLiveRecordsPage("active", 1, DEFAULT_PAGE_SIZE),
        ]);
        if (disposed) return;
        const nextActivePage = toPageState(active);
        setCounts(nextCounts);
        activePageRef.current = nextActivePage;
        setActivePage(nextActivePage);
      } catch (error) {
        console.error("Failed to initialize live records", error);
      } finally {
        if (!disposed) {
          setLoadingGroups((prev) => ({ ...prev, active: false }));
        }
      }
    };
    void initialize();
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    const requestId = historyRequestIdRef.current + 1;
    historyRequestIdRef.current = requestId;

    setLoadingGroups((prev) => ({ ...prev, history: true }));
    void api
      .getLiveRecordsPage("history", 1, historyPageSize)
      .then((history) => {
        if (!disposed && historyRequestIdRef.current === requestId) {
          const nextHistoryPage = toPageState(history);
          historyPageRef.current = nextHistoryPage;
          setHistoryPage(nextHistoryPage);
        }
      })
      .catch((error) => {
        console.error("Failed to load history live records", error);
      })
      .finally(() => {
        if (!disposed && historyRequestIdRef.current === requestId) {
          setLoadingGroups((prev) => ({ ...prev, history: false }));
        }
      });

    return () => {
      disposed = true;
    };
  }, [historyPageSize]);

  const flushProgressEvents = useCallback(
    (batchedEvents: Array<[string, LiveProgressEvent]>) => {
      const hasTerminalEvent = batchedEvents.some(
        ([, event]) => event.group !== "active"
      );

      setActivePage((prev) => {
        let next = prev;

        for (const [, event] of batchedEvents) {
          if (event.group === "active") {
            next = patchPageItem(next, event).nextPage;
            continue;
          }

          const itemCount = next.items.length;
          const items = next.items.filter((item) => item.id !== event.id);
          if (items.length !== itemCount) {
            next = {
              ...next,
              items,
              total: Math.max(0, next.total - 1),
            };
          }
        }

        activePageRef.current = next;
        return next;
      });

      if (!hasTerminalEvent) {
        return;
      }

      void refreshCounts().catch((error) => {
        console.error("Failed to refresh live counts", error);
      });
      void refreshGroup("active").catch((error) => {
        console.error("Failed to refresh active lives", error);
      });
      void refreshGroup("history").catch((error) => {
        console.error("Failed to refresh history lives", error);
      });
    },
    [refreshCounts, refreshGroup]
  );

  useEffect(() => {
    let disposed = false;
    let unlisten: UnlistenFn | undefined;
    const progressBatcher = createProgressBatcher<string, LiveProgressEvent>({
      intervalMs: PROGRESS_FLUSH_INTERVAL_MS,
      onFlush: flushProgressEvents,
    });

    void listen<LiveProgressEvent>("live-progress", ({ payload }) => {
      progressBatcher.enqueue(payload.id, payload);
    })
      .then((fn) => {
        if (disposed) {
          fn();
        } else {
          unlisten = fn;
        }
      })
      .catch((error) => {
        console.error("Failed to subscribe to live progress", error);
      });

    return () => {
      disposed = true;
      unlisten?.();
      progressBatcher.dispose();
    };
  }, [flushProgressEvents]);

  const addLiveRecord = useCallback(
    async (params: CreateLiveRecordParams) => {
      const task = await api.createLiveRecord(params);
      await refreshCounts();
      await refreshGroup("active", 1);
      return task;
    },
    [refreshCounts, refreshGroup]
  );

  const pause = useCallback(
    async (id: string) => {
      try {
        await api.pauseLiveRecord(id);
      } catch (error) {
        console.error("Failed to pause live record", error);
        message.error(t("failedToPause", { value0: error }));
      }
    },
    []
  );

  const resume = useCallback(
    async (id: string) => {
      try {
        await api.resumeLiveRecord(id);
        await refreshCounts();
        await refreshGroup("active");
      } catch (error) {
        console.error("Failed to resume live record", error);
        message.error(t("failedToResumeRecording", { value0: error }));
      }
    },
    [refreshCounts, refreshGroup]
  );

  const stop = useCallback(
    async (id: string) => {
      try {
        await api.stopLiveRecord(id);
      } catch (error) {
        console.error("Failed to stop live record", error);
        message.error(t("failedToStop", { value0: error }));
      }
    },
    []
  );

  const cancel = useCallback(
    async (id: string) => {
      try {
        await api.cancelLiveRecord(id);
        await refreshCounts();
        await Promise.all([refreshGroup("active"), refreshGroup("history")]);
      } catch (error) {
        console.error("Failed to cancel live record", error);
        message.error(t("failedToCancel", { value0: error }));
      }
    },
    [refreshCounts, refreshGroup]
  );

  const remove = useCallback(
    async (id: string, deleteFile: boolean) => {
      try {
        await api.removeLiveRecord(id, deleteFile);
        await refreshCounts();
        await Promise.all([refreshGroup("active"), refreshGroup("history")]);
      } catch (error) {
        console.error("Failed to remove live record", error);
        message.error(t("failedToDeleteTask", { value0: error }));
      }
    },
    [refreshCounts, refreshGroup]
  );

  const clearCompleted = useCallback(async () => {
    if (counts.history_count === 0) return;
    try {
      await api.clearLiveHistory();
      await refreshCounts();
      await refreshGroup("history", 1);
      message.success(t("completedRecordingsCleared"));
    } catch (error) {
      console.error("Failed to clear live history", error);
      message.error(t("failedToClearList", { value0: error }));
    }
  }, [counts.history_count, refreshCounts, refreshGroup]);
  const refreshActive = useCallback(
    (page?: number) => refreshGroup("active", page),
    [refreshGroup]
  );
  const refreshHistory = useCallback(
    (page?: number) => refreshGroup("history", page),
    [refreshGroup]
  );

  return {
    counts,
    recording: activePage.items,
    recordingPage: activePage.page,
    recordingPageSize: activePage.pageSize,
    recordingTotal: activePage.total,
    recorded: historyPage.items,
    recordedPage: historyPage.page,
    recordedPageSize: historyPage.pageSize,
    recordedTotal: historyPage.total,
    loadingActive: loadingGroups.active,
    loadingHistory: loadingGroups.history,
    addLiveRecord,
    pause,
    resume,
    stop,
    cancel,
    remove,
    clearCompleted,
    refreshCounts,
    refreshActive,
    refreshHistory,
  };
}
