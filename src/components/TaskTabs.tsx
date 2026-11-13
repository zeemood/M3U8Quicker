import { Button, Popconfirm, Tabs, Tag } from "antd";
import { ClearOutlined } from "@ant-design/icons";
import {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useMemo,
} from "react";
import { t, useTranslation } from "../i18n";
import {
  useDownloads,
  type BatchAddDownloadResult,
} from "../hooks/useDownloads";
import { useLiveRecords } from "../hooks/useLiveRecords";
import type {
  CreateDownloadParams,
  CreateLiveRecordParams,
  DownloadStatus,
  DownloadTaskSummary,
  LiveRecordSummary,
} from "../types";
import { liveRecordToDownloadSummary } from "../types";
import { DownloadList } from "./DownloadList";

type DownloadAction =
  | "pause"
  | "resume"
  | "cancel"
  | "stop"
  | "remove"
  | "open"
  | "play";

const ACTIVE_DOWNLOAD_ACTIONS: DownloadAction[] = [
  "play",
  "pause",
  "resume",
  "cancel",
  "open",
];
const HISTORY_DOWNLOAD_ACTIONS: DownloadAction[] = [
  "play",
  "remove",
  "open",
];
const ACTIVE_LIVE_ACTIONS: DownloadAction[] = [
  "play",
  "pause",
  "resume",
  "stop",
  "cancel",
  "open",
];
const HISTORY_LIVE_ACTIONS: DownloadAction[] = ["play", "remove", "open"];
const noop = () => undefined;

const noopGetSegmentState = async () => ({
  id: "",
  total_segments: 0,
  completed_segment_indices: [],
  failed_segment_indices: [],
  updated_at: new Date().toISOString(),
});

export interface TaskTabsHandle {
  addDownload: (params: CreateDownloadParams) => Promise<DownloadTaskSummary>;
  addDownloadsBatch: (
    paramsList: CreateDownloadParams[]
  ) => Promise<BatchAddDownloadResult[]>;
  addLiveRecord: (params: CreateLiveRecordParams) => Promise<unknown>;
  stopLive: (id: string) => Promise<void>;
}

export interface TaskTabsProps {
  historyPageSize: number;
  onPlayDownload: (task: DownloadTaskSummary) => void;
  onPlayLive: (task: DownloadTaskSummary) => void;
  onAnalyze: (filePath: string) => void;
  onRequestStopLive: (record: LiveRecordSummary) => void;
}

export const TaskTabs = memo(
  forwardRef<TaskTabsHandle, TaskTabsProps>(function TaskTabs(
    {
      historyPageSize,
      onPlayDownload,
      onPlayLive,
      onAnalyze,
      onRequestStopLive,
    },
    ref
  ) {
    const { i18n } = useTranslation();
    const {
      counts,
      downloading,
      downloadingPage,
      downloadingPageSize,
      downloadingTotal,
      completed,
      completedPage,
      completedPageSize,
      completedTotal,
      addDownload,
      addDownloadsBatch,
      pause,
      resume,
      retryFailed,
      cancel,
      remove,
      clearCompleted,
      refreshActive,
      refreshHistory,
      loadingActive,
      loadingHistory,
      getSegmentState,
    } = useDownloads(historyPageSize);
    const {
      counts: liveCounts,
      recording,
      recordingPage,
      recordingPageSize,
      recordingTotal,
      recorded,
      recordedPage,
      recordedPageSize,
      recordedTotal,
      addLiveRecord,
      pause: pauseLive,
      resume: resumeLive,
      stop: stopLive,
      cancel: cancelLive,
      remove: removeLive,
      clearCompleted: clearLiveCompleted,
      refreshActive: refreshLiveActive,
      refreshHistory: refreshLiveHistory,
      loadingActive: loadingLiveActive,
      loadingHistory: loadingLiveHistory,
    } = useLiveRecords(historyPageSize);
    const language = i18n.language;

    useImperativeHandle(
      ref,
      () => ({
        addDownload,
        addDownloadsBatch,
        addLiveRecord,
        stopLive,
      }),
      [addDownload, addDownloadsBatch, addLiveRecord, stopLive]
    );

    const liveRecordingItems = useMemo(
      () => recording.map(liveRecordToDownloadSummary),
      [recording]
    );
    const liveRecordedItems = useMemo(
      () => recorded.map(liveRecordToDownloadSummary),
      [recorded]
    );

    const handleActivePageChange = useCallback(
      (page: number) => {
        void refreshActive(page);
      },
      [refreshActive]
    );
    const handleHistoryPageChange = useCallback(
      (page: number) => {
        void refreshHistory(page);
      },
      [refreshHistory]
    );
    const handleLiveActivePageChange = useCallback(
      (page: number) => {
        void refreshLiveActive(page);
      },
      [refreshLiveActive]
    );
    const handleLiveHistoryPageChange = useCallback(
      (page: number) => {
        void refreshLiveHistory(page);
      },
      [refreshLiveHistory]
    );
    const handleStopLive = useCallback(
      (id: string) => {
        const record = recording.find((item) => item.id === id);
        if (!record) {
          void stopLive(id);
          return;
        }
        onRequestStopLive(record);
      },
      [onRequestStopLive, recording, stopLive]
    );
    const liveStatusTagOverride = useCallback(
      (status: DownloadStatus) => {
        if (status === "Downloading")
          return <Tag color="processing">{t("recording", { lng: language })}</Tag>;
        if (status === "Paused")
          return <Tag color="warning">{t("paused", { lng: language })}</Tag>;
        if (status === "Completed")
          return <Tag color="success">{t("recorded", { lng: language })}</Tag>;
        if (status === "Cancelled")
          return <Tag color="default">{t("cancelled", { lng: language })}</Tag>;
        if (typeof status === "object" && "Failed" in status)
          return <Tag color="error">{t("failed", { lng: language })}</Tag>;
        return undefined;
      },
      [language]
    );
    const liveCancelLabels = useMemo(
      () => ({
        title: t("cancelRecording", { lng: language }),
        description: t("recordedFilesWillBePermanentlyDeleted", { lng: language }),
        okText: t("cancelAndDelete", { lng: language }),
        cancelText: t("continueRecording", { lng: language }),
      }),
      [language]
    );
    const downloadHistoryHeader = useMemo(
      () => (
        <Popconfirm
          title={t("clearThisList", { lng: language })}
          description={t("onlyCompletedRecordsWillBeRemovedLocalFilesWillBe", {
            lng: language,
          })}
          onConfirm={() => void clearCompleted()}
          okText={t("clearList", { lng: language })}
          cancelText={t("cancel", { lng: language })}
          disabled={counts.history_count === 0}
        >
          <Button
            type="text"
            size="small"
            danger
            icon={<ClearOutlined />}
            aria-label={t("clearList", { lng: language })}
            disabled={counts.history_count === 0}
          />
        </Popconfirm>
      ),
      [clearCompleted, counts.history_count, language]
    );
    const liveHistoryHeader = useMemo(
      () => (
        <Popconfirm
          title={t("clearThisList", { lng: language })}
          description={t(
            "onlyCompletedRecordingRecordsWillBeRemovedLocalFilesWill",
            { lng: language }
          )}
          onConfirm={() => void clearLiveCompleted()}
          okText={t("clearList", { lng: language })}
          cancelText={t("cancel", { lng: language })}
          disabled={liveCounts.history_count === 0}
        >
          <Button
            type="text"
            size="small"
            danger
            icon={<ClearOutlined />}
            aria-label={t("clearList", { lng: language })}
            disabled={liveCounts.history_count === 0}
          />
        </Popconfirm>
      ),
      [clearLiveCompleted, language, liveCounts.history_count]
    );

    const tabItems = [
      {
        key: "downloading",
        label: t("downloading", { value0: counts.active_count }),
        children: (
          <DownloadList
            downloads={downloading}
            total={downloadingTotal}
            currentPage={downloadingPage}
            pageSize={downloadingPageSize}
            onPageChange={handleActivePageChange}
            getSegmentState={getSegmentState}
            onPause={pause}
            onResume={resume}
            onRetryFailed={retryFailed}
            onCancel={cancel}
            onRemove={remove}
            onPlay={onPlayDownload}
            loading={loadingActive}
            showActions={ACTIVE_DOWNLOAD_ACTIONS}
          />
        ),
      },
      {
        key: "completed",
        label: t("completed", { value0: counts.history_count }),
        children: (
          <DownloadList
            downloads={completed}
            total={completedTotal}
            currentPage={completedPage}
            pageSize={completedPageSize}
            onPageChange={handleHistoryPageChange}
            getSegmentState={getSegmentState}
            onPause={pause}
            onResume={resume}
            onRetryFailed={retryFailed}
            onCancel={cancel}
            onRemove={remove}
            onPlay={onPlayDownload}
            loading={loadingHistory}
            onAnalyze={onAnalyze}
            showActions={HISTORY_DOWNLOAD_ACTIONS}
            showSpeed={false}
            actionsHeaderExtra={downloadHistoryHeader}
          />
        ),
      },
      {
        key: "live-recording",
        label: t("liveRecordings", { value0: liveCounts.active_count }),
        children: (
          <DownloadList
            downloads={liveRecordingItems}
            total={recordingTotal}
            currentPage={recordingPage}
            pageSize={recordingPageSize}
            onPageChange={handleLiveActivePageChange}
            getSegmentState={noopGetSegmentState}
            onPause={pauseLive}
            onResume={resumeLive}
            onRetryFailed={noop}
            onCancel={cancelLive}
            onRemove={removeLive}
            onStop={handleStopLive}
            onPlay={onPlayLive}
            loading={loadingLiveActive}
            showActions={ACTIVE_LIVE_ACTIONS}
            statusTagOverride={liveStatusTagOverride}
            cancelLabels={liveCancelLabels}
          />
        ),
      },
      {
        key: "live-recorded",
        label: t("recorded2", { value0: liveCounts.history_count }),
        children: (
          <DownloadList
            downloads={liveRecordedItems}
            total={recordedTotal}
            currentPage={recordedPage}
            pageSize={recordedPageSize}
            onPageChange={handleLiveHistoryPageChange}
            getSegmentState={noopGetSegmentState}
            onPause={noop}
            onResume={noop}
            onRetryFailed={noop}
            onCancel={noop}
            onRemove={removeLive}
            onPlay={onPlayLive}
            loading={loadingLiveHistory}
            showActions={HISTORY_LIVE_ACTIONS}
            showSpeed={false}
            statusTagOverride={liveStatusTagOverride}
            actionsHeaderExtra={liveHistoryHeader}
          />
        ),
      },
    ];

    return (
      <Tabs
        items={tabItems}
        defaultActiveKey="downloading"
        destroyOnHidden
      />
    );
  })
);
