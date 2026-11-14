import { t, useTranslation } from "../i18n";
import { useEffect, useMemo, useState } from "react";
import {
  AutoComplete,
  Button,
  Checkbox,
  Collapse,
  Input,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
  theme,
} from "antd";
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CodeOutlined,
  DeleteOutlined,
  EditOutlined,
  GlobalOutlined,
  LinkOutlined,
  PlusOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import {
  applyFilenameCleanupRulesWithMatch,
  getFilenameCleanupRegexCaptureGroups,
  normalizeFilenameCleanupSite,
  removeTitleQueryParameter,
  validateFilenameCleanupRule,
} from "../extensions/develop/filenameCleanup";
import { deriveFilenameFromUrl } from "../types";
import type {
  FilenameCleanupMatchType,
  FilenameCleanupRule,
  FilenameCleanupScope,
} from "../types/settings";

const MAX_RULES = 100;
let ruleIdSequence = 0;

interface FilenameCleanupRulesEditorProps {
  rules: FilenameCleanupRule[];
  saving: boolean;
  onChange: (rules: FilenameCleanupRule[]) => void;
  onSave: (rules?: FilenameCleanupRule[]) => void;
}

interface RuleGroup {
  key: string;
  scope: FilenameCleanupScope;
  site: string;
  rules: FilenameCleanupRule[];
}

export function FilenameCleanupRulesEditor({
  rules,
  saving,
  onChange,
  onSave,
}: FilenameCleanupRulesEditorProps) {
  useTranslation();
  const { token } = theme.useToken();
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [testFilename, setTestFilename] = useState("");
  const [testSourceUrl, setTestSourceUrl] = useState("");
  const groups = useMemo(() => groupRules(rules), [rules]);
  const siteOptions = useMemo(
    () =>
      Array.from(
        new Set(
          rules
            .filter((rule) => rule.scope === "site")
            .map((rule) => normalizeFilenameCleanupSite(rule.site ?? ""))
            .filter(Boolean)
        )
      )
        .sort()
        .map((site) => ({ value: site, label: site })),
    [rules]
  );
  const editingRule =
    rules.find((rule) => rule.id === editingRuleId) ?? null;

  const updateRule = (
    id: string,
    patch: Partial<FilenameCleanupRule>
  ) => {
    onChange(
      rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule))
    );
  };

  const addRule = (scope: FilenameCleanupScope = "global", site = "") => {
    if (rules.length >= MAX_RULES) return;
    const id = createRuleId();
    onChange([
      ...rules,
      {
        id,
        enabled: true,
        scope,
        site: scope === "site" ? normalizeFilenameCleanupSite(site) : "",
        match_type: "contains",
        pattern: "",
        replacement: "",
        case_sensitive: false,
      },
    ]);
    setEditingRuleId(id);
  };

  const deleteRule = (id: string) => {
    const nextRules = rules.filter((rule) => rule.id !== id);
    onChange(nextRules);
    onSave(nextRules);
    if (editingRuleId === id) {
      setEditingRuleId(null);
    }
  };

  if (editingRule) {
    return (
      <Space direction="vertical" size={14} style={{ width: "100%" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <Space size={10} wrap>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => setEditingRuleId(null)}
            >
              {t("back")}
            </Button>
            <Typography.Text strong>{t("filenameCleanupEditMode")}</Typography.Text>
            <Tag bordered={false}>
              {ruleGroupLabel(editingRule)}
            </Tag>
          </Space>
          <Space size={8}>
            <Button
              type="primary"
              size="small"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={() => onSave()}
            >
              {t("saveCleanupRules")}
            </Button>
          </Space>
        </div>

        <RuleTestBlock
          rules={rules}
          focusedRule={editingRule}
          sourceUrl={testSourceUrl}
          filename={testFilename}
          onSourceUrlChange={setTestSourceUrl}
          onFilenameChange={setTestFilename}
        />

        <div
          style={{
            padding: 14,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: token.borderRadiusLG,
            background: token.colorFillQuaternary,
          }}
        >
          <RuleEditor
            rule={editingRule}
            siteOptions={siteOptions}
            onChange={(patch) => updateRule(editingRule.id, patch)}
            onDelete={() => deleteRule(editingRule.id)}
          />
        </div>
      </Space>
    );
  }

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Space size={8} wrap>
          <Tag bordered={false}>
            {rules.length} / {MAX_RULES}
          </Tag>
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => addRule()}
            disabled={rules.length >= MAX_RULES}
          >
            {t("addRule")}
          </Button>
        </Space>
      </div>

      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {t("filenameCleanupRulesOnlyApplyToAutomaticallyDerivedNames")}
      </Typography.Text>

      <RuleTestBlock
        rules={rules}
        sourceUrl={testSourceUrl}
        filename={testFilename}
        onSourceUrlChange={setTestSourceUrl}
        onFilenameChange={setTestFilename}
      />

      {rules.length === 0 ? (
        <div
          style={{
            padding: "20px 16px",
            border: `1px dashed ${token.colorBorder}`,
            borderRadius: token.borderRadiusLG,
            color: token.colorTextSecondary,
            textAlign: "center",
          }}
        >
          {t("noFilenameCleanupRules")}
        </div>
      ) : (
        <RuleGroupsCollapse
          key={groups.map((group) => group.key).join("|")}
          groups={groups}
          onEdit={setEditingRuleId}
          onDelete={deleteRule}
        />
      )}

      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {t("filenameCleanupOrderHint")}
      </Typography.Text>
    </Space>
  );
}

function RuleTestBlock({
  rules,
  focusedRule,
  sourceUrl,
  filename,
  onSourceUrlChange,
  onFilenameChange,
}: {
  rules: FilenameCleanupRule[];
  focusedRule?: FilenameCleanupRule;
  sourceUrl: string;
  filename: string;
  onSourceUrlChange: (value: string) => void;
  onFilenameChange: (value: string) => void;
}) {
  const { token } = theme.useToken();
  const rulesToApply = focusedRule ? [focusedRule] : rules;
  const focusedSite =
    focusedRule?.scope === "site"
      ? normalizeFilenameCleanupSite(focusedRule.site ?? "")
      : "";
  const effectiveSourceUrl =
    sourceUrl.trim() || (focusedSite ? `https://${focusedSite}/` : "");
  const effectiveFilename =
    filename.trim() ||
    (effectiveSourceUrl ? deriveFilenameFromUrl(effectiveSourceUrl) : "");
  const result = applyFilenameCleanupRulesWithMatch(
    effectiveFilename,
    rulesToApply,
    effectiveSourceUrl
  );
  const cleanedUrl = result.matched
    ? removeTitleQueryParameter(effectiveSourceUrl)
    : effectiveSourceUrl;
  const regexCaptures = rulesToApply.flatMap((rule) => {
    const groups = getFilenameCleanupRegexCaptureGroups(
      effectiveFilename,
      rule,
      effectiveSourceUrl
    );
    return groups.length > 0 ? [{ rule, groups }] : [];
  });

  return (
    <div
      style={{
        padding: 10,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        background: token.colorFillQuaternary,
      }}
    >
      <Space direction="vertical" size={8} style={{ width: "100%" }}>
        <Typography.Text strong>{t("cleanupPreview")}</Typography.Text>
        <div style={{ display: "grid", gap: 8 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "58px minmax(0, 1fr) auto minmax(0, 1fr)",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t("url")}
            </Typography.Text>
            <Input
              value={sourceUrl}
              placeholder={t("filenameCleanupTestSourceUrl")}
              onChange={(event) => onSourceUrlChange(event.target.value)}
              prefix={<LinkOutlined />}
              allowClear
            />
            <ArrowRightOutlined style={{ color: token.colorTextTertiary }} />
            <RuleTestValue value={cleanedUrl} />
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "58px minmax(0, 1fr)",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t("filename")}
            </Typography.Text>
            <Input
              value={filename}
              placeholder={t("sampleFilename")}
              onChange={(event) => onFilenameChange(event.target.value)}
              allowClear
            />
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "58px auto minmax(0, 1fr)",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t("cleanupPreview")}
            </Typography.Text>
            <ArrowRightOutlined style={{ color: token.colorTextTertiary }} />
            <RuleTestValue value={result.filename} />
          </div>
          {regexCaptures.length > 0 ? (
            <div style={{ display: "grid", gap: 6 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t("filenameCleanupRegexGroups")}
              </Typography.Text>
              {regexCaptures.map(({ rule, groups }) => (
                <div
                  key={rule.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >
                  {groups.map((group) => (
                    <span
                      key={group.index}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        minWidth: 0,
                        padding: "3px 7px",
                        border: `1px solid ${token.colorBorderSecondary}`,
                        borderRadius: token.borderRadiusSM,
                        background: token.colorBgContainer,
                        fontSize: 12,
                      }}
                    >
                      <Typography.Text code>
                        ${group.index}
                      </Typography.Text>
                      <Typography.Text
                        ellipsis={{ tooltip: group.value || "--" }}
                        style={{ minWidth: 0 }}
                      >
                        {group.value || "--"}
                      </Typography.Text>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </Space>
    </div>
  );
}

function RuleTestValue({ value }: { value: string }) {
  return (
    <div
      style={{
        minWidth: 0,
        display: "flex",
        alignItems: "center",
      }}
    >
      <Typography.Text
        code
        ellipsis={{ tooltip: value || "--" }}
        type={value ? undefined : "secondary"}
        style={{
          minWidth: 0,
          width: "100%",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 12,
        }}
      >
        {value || "--"}
      </Typography.Text>
    </div>
  );
}

function RuleGroupsCollapse({
  groups,
  onEdit,
  onDelete,
}: {
  groups: RuleGroup[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [activeKeys, setActiveKeys] = useState<string[]>(() =>
    groups.map((group) => group.key)
  );

  return (
    <Collapse
      size="small"
      activeKey={activeKeys}
      onChange={(keys) =>
        setActiveKeys(Array.isArray(keys) ? keys.map(String) : [String(keys)])
      }
      items={groups.map((group) => {
        const isGlobal = group.scope === "global";
        const title = isGlobal
          ? t("filenameCleanupGlobalRules")
          : normalizeFilenameCleanupSite(group.site) ||
            t("filenameCleanupUnassignedSite");

        return {
          key: group.key,
          label: (
            <Space size={8}>
              {isGlobal ? <GlobalOutlined /> : <LinkOutlined />}
              <Typography.Text strong>{title}</Typography.Text>
              <Tag bordered={false} style={{ marginInlineEnd: 0 }}>
                {group.rules.length}
              </Tag>
            </Space>
          ),
          children: (
            <div style={{ margin: "-6px -12px" }}>
              {group.rules.map((rule, index) => (
                <RuleSummaryRow
                  key={rule.id}
                  rule={rule}
                  index={index}
                  onEdit={() => onEdit(rule.id)}
                  onDelete={() => onDelete(rule.id)}
                />
              ))}
            </div>
          ),
        };
      })}
    />
  );
}

function RuleSummaryRow({
  rule,
  index,
  onEdit,
  onDelete,
}: {
  rule: FilenameCleanupRule;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { token } = theme.useToken();
  const matchLabel =
    rule.match_type === "regex"
      ? t("filenameCleanupRegex")
      : rule.match_type === "suffix"
        ? t("suffix")
        : t("containsText");

  return (
    <div
      className="filename-cleanup-rule-row"
      role="button"
      tabIndex={0}
      aria-label={t("filenameCleanupEditMode")}
      onClick={onEdit}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onEdit();
        }
      }}
      style={{
        display: "grid",
        gridTemplateColumns: "26px auto auto minmax(0, 1fr) 24px 28px",
        alignItems: "center",
        gap: 8,
        minHeight: 40,
        padding: "6px 9px",
        borderTop: index === 0 ? "none" : `1px solid ${token.colorSplit}`,
        opacity: rule.enabled ? 1 : 0.55,
      }}
    >
      <Tag
        bordered={false}
        style={{
          margin: 0,
          minWidth: 22,
          paddingInline: 4,
          textAlign: "center",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {index + 1}
      </Tag>
      <Tag
        bordered={false}
        color={rule.enabled ? "success" : "default"}
        style={{ marginInlineEnd: 0 }}
      >
        {rule.enabled ? t("enabled") : t("disabled")}
      </Tag>
      <Tag
        bordered={false}
        color={
          rule.match_type === "regex"
            ? "processing"
            : rule.match_type === "suffix"
              ? "gold"
              : "default"
        }
        style={{ marginInlineEnd: 0 }}
      >
        {rule.match_type === "regex" ? <CodeOutlined /> : null} {matchLabel}
      </Tag>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr) auto",
          alignItems: "center",
          gap: 6,
          minWidth: 0,
          overflow: "hidden",
          whiteSpace: "nowrap",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 12,
        }}
      >
        <Typography.Text
          code
          ellipsis={{ tooltip: rule.pattern }}
          style={{ minWidth: 0, width: "100%" }}
        >
          {rule.pattern}
        </Typography.Text>
        <span style={{ flex: "0 0 auto", color: token.colorTextTertiary }}>
          -&gt;
        </span>
        <Typography.Text
          code
          ellipsis={{ tooltip: rule.replacement || "--" }}
          type={rule.replacement ? undefined : "secondary"}
          style={{ minWidth: 0, width: "100%" }}
        >
          {rule.replacement || "--"}
        </Typography.Text>
        {rule.case_sensitive ? (
          <Tooltip title={t("caseSensitive")}>
            <Tag
              bordered={false}
              style={{ flex: "0 0 auto", marginInlineEnd: 0 }}
            >
              Aa
            </Tag>
          </Tooltip>
        ) : null}
      </div>
      <Tooltip title={t("filenameCleanupEditMode")}>
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
            color: token.colorTextSecondary,
          }}
        >
          <EditOutlined />
        </span>
      </Tooltip>
      <Tooltip title={t("delete")}>
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          aria-label={t("delete")}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        />
      </Tooltip>
    </div>
  );
}

function RuleEditor({
  rule,
  siteOptions,
  onChange,
  onDelete,
}: {
  rule: FilenameCleanupRule;
  siteOptions: Array<{ value: string; label: string }>;
  onChange: (patch: Partial<FilenameCleanupRule>) => void;
  onDelete: () => void;
}) {
  const validation = validateFilenameCleanupRule(rule);
  const showRegexError = validation === "regex" && rule.pattern.trim();
  const showSiteError =
    rule.scope === "site" && validation === "site" && rule.pattern.trim();

  return (
    <div style={{ opacity: rule.enabled ? 1 : 0.7 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <Space size={8}>
          <Switch
            checked={rule.enabled}
            onChange={(enabled) => onChange({ enabled })}
            aria-label={t("enabled")}
          />
          <Typography.Text>
            {rule.enabled ? t("enabled") : t("disabled")}
          </Typography.Text>
        </Space>
        <Button
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={onDelete}
        >
          {t("delete")}
        </Button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 16,
          marginBottom: 12,
        }}
      >
        <div style={{ display: "grid", gap: 5 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t("filenameCleanupRuleType")}
          </Typography.Text>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                rule.scope === "site"
                  ? "130px minmax(0, 1fr)"
                  : "130px",
              gap: 8,
            }}
          >
            <Select<FilenameCleanupScope>
              value={rule.scope}
              options={[
                { value: "global", label: t("filenameCleanupGlobalRules") },
                { value: "site", label: t("filenameCleanupSourceSite") },
              ]}
              onChange={(scope) =>
                onChange({
                  scope,
                  site: scope === "global" ? "" : rule.site,
                })
              }
            />
            {rule.scope === "site" ? (
              <RuleSiteInput
                value={rule.site}
                options={siteOptions}
                status={showSiteError ? "error" : undefined}
                onChange={(site) => onChange({ site })}
              />
            ) : null}
          </div>
        </div>

        <div style={{ display: "grid", gap: 5 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t("filenameCleanupMatchType")}
          </Typography.Text>
          <Space size={10} wrap>
            <Select<FilenameCleanupMatchType>
              value={rule.match_type}
              style={{ width: 130 }}
              options={[
                { value: "contains", label: t("containsText") },
                { value: "suffix", label: t("suffix") },
                { value: "regex", label: t("filenameCleanupRegex") },
              ]}
              onChange={(match_type) => onChange({ match_type })}
            />
            <Checkbox
              checked={rule.case_sensitive}
              onChange={(event) =>
                onChange({ case_sensitive: event.target.checked })
              }
            >
              {t("caseSensitive")}
            </Checkbox>
          </Space>
        </div>
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
          maxLength={512}
          placeholder={
            rule.match_type === "regex"
              ? t("filenameCleanupRegex")
              : t("matchText")
          }
          status={showRegexError ? "error" : undefined}
          onChange={(event) => onChange({ pattern: event.target.value })}
        />
        <Input
          value={rule.replacement}
          maxLength={512}
          placeholder={t("replaceWithLeaveBlankToDelete")}
          onChange={(event) => onChange({ replacement: event.target.value })}
        />
      </div>

      {rule.match_type === "regex" ? (
        <Typography.Text
          type="secondary"
          style={{ display: "block", marginTop: 8, fontSize: 12 }}
        >
          {t("filenameCleanupRegexReplacementHint")}
        </Typography.Text>
      ) : null}
      {showRegexError ? (
        <Typography.Text
          type="danger"
          style={{ display: "block", marginTop: 6, fontSize: 12 }}
        >
          {t("filenameCleanupInvalidRegex")}
        </Typography.Text>
      ) : null}
      {showSiteError ? (
        <Typography.Text
          type="danger"
          style={{ display: "block", marginTop: 6, fontSize: 12 }}
        >
          {t("filenameCleanupSiteRequired")}
        </Typography.Text>
      ) : null}
    </div>
  );
}

function RuleSiteInput({
  value,
  options,
  status,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  status?: "error";
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    const normalized = normalizeFilenameCleanupSite(draft);
    setDraft(normalized);
    if (normalized !== value) {
      onChange(normalized);
    }
  };

  return (
    <AutoComplete
      value={draft}
      options={options}
      onChange={setDraft}
      onBlur={commit}
      onSelect={(nextValue: string) => {
        setDraft(nextValue);
        onChange(normalizeFilenameCleanupSite(nextValue));
      }}
      filterOption={(inputValue, option) =>
        String(option?.value ?? "")
          .toLowerCase()
          .includes(inputValue.toLowerCase())
      }
    >
      <Input
        status={status}
        prefix={<LinkOutlined />}
        placeholder={t("filenameCleanupSitePlaceholder")}
        onPressEnter={commit}
      />
    </AutoComplete>
  );
}

function ruleGroupLabel(rule: FilenameCleanupRule): string {
  if (rule.scope !== "site") {
    return t("filenameCleanupGlobalRules");
  }
  return (
    normalizeFilenameCleanupSite(rule.site ?? "") ||
    t("filenameCleanupUnassignedSite")
  );
}

function groupRules(rules: FilenameCleanupRule[]): RuleGroup[] {
  const globalRules = rules.filter((rule) => rule.scope !== "site");
  const siteMap = new Map<string, FilenameCleanupRule[]>();

  for (const rule of rules) {
    if (rule.scope !== "site") continue;
    const site = normalizeFilenameCleanupSite(rule.site ?? "");
    const currentRules = siteMap.get(site) ?? [];
    currentRules.push(rule);
    siteMap.set(site, currentRules);
  }

  const groups: RuleGroup[] = [];
  if (globalRules.length > 0) {
    groups.push({
      key: "global",
      scope: "global",
      site: "",
      rules: globalRules,
    });
  }
  for (const [site, siteRules] of [...siteMap.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    groups.push({
      key: `site:${site}`,
      scope: "site",
      site,
      rules: siteRules,
    });
  }
  return groups;
}

function createRuleId() {
  return `cleanup-${Date.now()}-${ruleIdSequence++}`;
}
