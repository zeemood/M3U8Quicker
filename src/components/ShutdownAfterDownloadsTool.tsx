import { t, useTranslation } from "../i18n";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Modal,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from "antd";
import { PoweroffOutlined } from "@ant-design/icons";
import {
  getDownloadShutdownStatus,
  setDownloadShutdownArmed,
} from "../services/api";
import type { DownloadShutdownStatus } from "../types";

interface ShutdownAfterDownloadsToolProps {
  open: boolean;
  onClose: () => void;
}

export function ShutdownAfterDownloadsTool({
  open,
  onClose,
}: ShutdownAfterDownloadsToolProps) {
  useTranslation();
  const [status, setStatus] = useState<DownloadShutdownStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await getDownloadShutdownStatus());
    } catch (error) {
      message.error(
        t("failedToReadDownloadShutdownStatus", {
          value0: formatShutdownError(error),
        })
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    void refreshStatus();
    const timer = window.setInterval(() => {
      void getDownloadShutdownStatus()
        .then(setStatus)
        .catch(() => {});
    }, 1000);

    return () => window.clearInterval(timer);
  }, [open, refreshStatus]);

  const updateArmed = async (enabled: boolean) => {
    setUpdating(true);
    try {
      const next = await setDownloadShutdownArmed(enabled);
      setStatus(next);
      message.success(
        enabled ? t("downloadShutdownArmed") : t("downloadShutdownCancelled")
      );
    } catch (error) {
      message.error(
        t("failedToUpdateDownloadShutdown", {
          value0: formatShutdownError(error),
        })
      );
      await refreshStatus();
    } finally {
      setUpdating(false);
    }
  };

  const handleToggle = (enabled: boolean) => {
    if (!enabled) {
      void updateArmed(false);
      return;
    }

    Modal.confirm({
      title: t("armShutdownAfterDownloads"),
      icon: <PoweroffOutlined style={{ color: "#fa8c16" }} />,
      content: t("shutdownAfterDownloadsConfirmation"),
      okText: t("armShutdown"),
      cancelText: t("cancel"),
      onOk: () => updateArmed(true),
    });
  };

  const armed = Boolean(status?.armed || status?.pending);
  const activeDownloads = status?.active_downloads ?? 0;

  return (
    <Modal
      title={
        <Space size={8}>
          <PoweroffOutlined />
          <span>{t("shutdownAfterDownloads")}</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>{t("close")}</Button>}
      width={520}
      destroyOnClose
    >
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "14px 16px",
            border: "1px solid rgba(127, 127, 127, 0.24)",
            borderRadius: 8,
          }}
        >
          <Space direction="vertical" size={4}>
            <Typography.Text strong>{t("afterAllDownloadTasksEnd")}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t("downloadShutdownToolDescription")}
            </Typography.Text>
          </Space>
          <Switch
            checked={armed}
            loading={loading || updating}
            onChange={handleToggle}
            aria-label={t("shutdownAfterDownloads")}
          />
        </div>

        {status?.pending ? (
          <Alert
            type="warning"
            showIcon
            message={t("shutdownCountdownActive", {
              value0: status.countdown_seconds,
            })}
            description={t("cancelFromThisToolBeforeTheCountdownEnds")}
            action={
              <Button size="small" onClick={() => void updateArmed(false)}>
                {t("cancelShutdown")}
              </Button>
            }
          />
        ) : status?.armed ? (
          <Alert
            type="info"
            showIcon
            message={
              activeDownloads > 0
                ? t("waitingForDownloadTasksToFinish", {
                    value0: activeDownloads,
                  })
                : t("waitingForANewDownloadTask")
            }
          />
        ) : null}

        <Space size={8}>
          <Tag bordered={false} color={armed ? "processing" : "default"}>
            {armed ? t("enabled") : t("disabled")}
          </Tag>
          <Tag bordered={false}>
            {t("activeDownloadTasksCount", { value0: activeDownloads })}
          </Tag>
        </Space>

        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t("downloadShutdownOnlyAffectsDownloadTasks")}
        </Typography.Text>
      </Space>
    </Modal>
  );
}

function formatShutdownError(error: unknown) {
  const text = String(error ?? "").trim();
  if (!text) return t("unknownError");
  return text.replace(/^(Invalid input|IO error):\s*/i, "");
}
