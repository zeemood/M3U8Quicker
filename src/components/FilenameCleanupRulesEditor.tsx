import { t, useTranslation } from "../i18n";
import { useState } from "react";
import {
  Button,
  Checkbox,
  Input,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
  theme,
} from "antd";
import { DeleteOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { applyFilenameCleanupRules } from "../types";
import type {
  FilenameCleanupMatchType,
  FilenameCleanupRule,
} from "../types/settings";

const MAX_RULES = 100;
let ruleIdSequence = 0;

interface FilenameCleanupRulesEditorProps {
  rules: FilenameCleanupRule[];
  saving: boolean;
  onChange: (rules: FilenameCleanupRule[]) => void;
  onSave: () => void;
}

export function FilenameCleanupRulesEditor({
  rules,
  saving,
  onChange,
  onSave,
}: FilenameCleanupRulesEditorProps) {
  useTranslation();
  const { token } = theme.useToken();
  const [sample, setSample] = useState("");
  const preview = sample.trim()
    ? applyFilenameCleanupRules(sample.trim(), rules)
    : "";

  const updateRule = (
    id: string,
    patch: Partial<FilenameCleanupRule>
  ) => {
    onChange(
      rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule))
    );
  };

  const addRule = () => {
    if (rules.length >= MAX_RULES) return;
    onChange([
      ...rules,
      {
        id: `cleanup-${Date.now()}-${ruleIdSequence++}`,
        enabled: true,
        match_type: "contains",
        pattern: "",
        replacement: "",
        case_sensitive: false,
      },
    ]);
  };

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t("filenameCleanupRulesOnlyApplyToAutomaticallyDerivedNames")}
        </Typography.Text>
        <Tag bordered={false}>{rules.length} / {MAX_RULES}</Tag>
      </div>

      {rules.length === 0 ? (
        <div
          style={{
            padding: "18px 16px",
            border: `1px dashed ${token.colorBorder}`,
            borderRadius: token.borderRadiusLG,
            color: token.colorTextSecondary,
            textAlign: "center",
          }}
        >
          {t("noFilenameCleanupRules")}
        </div>
      ) : (
        <Space direction="vertical" size={10} style={{ width: "100%" }}>
          {rules.map((rule, index) => (
            <div
              key={rule.id}
              style={{
                padding: 12,
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: token.borderRadiusLG,
                background: token.colorFillQuaternary,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <Tag bordered={false}>{index + 1}</Tag>
                <Switch
                  size="small"
                  checked={rule.enabled}
                  onChange={(enabled) => updateRule(rule.id, { enabled })}
                  aria-label={t("enabled")}
                />
                <Select<FilenameCleanupMatchType>
                  size="small"
                  value={rule.match_type}
                  style={{ width: 108 }}
                  options={[
                    { value: "contains", label: t("containsText") },
                    { value: "suffix", label: t("suffix") },
                  ]}
                  onChange={(match_type) => updateRule(rule.id, { match_type })}
                />
                <div style={{ flex: 1 }} />
                <Tooltip title={t("delete")}>
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    aria-label={t("delete")}
                    onClick={() =>
                      onChange(rules.filter((item) => item.id !== rule.id))
                    }
                  />
                </Tooltip>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                  gap: 8,
                }}
              >
                <Input
                  value={rule.pattern}
                  placeholder={t("matchText")}
                  onChange={(event) =>
                    updateRule(rule.id, { pattern: event.target.value })
                  }
                />
                <Input
                  value={rule.replacement}
                  placeholder={t("replaceWithLeaveBlankToDelete")}
                  onChange={(event) =>
                    updateRule(rule.id, { replacement: event.target.value })
                  }
                />
              </div>

              <Checkbox
                checked={rule.case_sensitive}
                style={{ marginTop: 10 }}
                onChange={(event) =>
                  updateRule(rule.id, {
                    case_sensitive: event.target.checked,
                  })
                }
              >
                {t("caseSensitive")}
              </Checkbox>
            </div>
          ))}
        </Space>
      )}

      <Button
        icon={<PlusOutlined />}
        onClick={addRule}
        disabled={rules.length >= MAX_RULES}
        block
      >
        {t("addRule")}
      </Button>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 8,
        }}
      >
        <Input
          value={sample}
          placeholder={t("sampleFilename")}
          onChange={(event) => setSample(event.target.value)}
        />
        <Input
          readOnly
          value={preview}
          placeholder={t("cleanupPreview")}
        />
      </div>

      <Button
        type="primary"
        icon={<SaveOutlined />}
        loading={saving}
        onClick={onSave}
        style={{ alignSelf: "flex-start" }}
      >
        {t("saveCleanupRules")}
      </Button>
    </Space>
  );
}
