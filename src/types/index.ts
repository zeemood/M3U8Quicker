import type { FilenameCleanupRule } from "./settings";

export type DownloadStatus =
  | "Pending"
  | "Downloading"
  | "Paused"
  | "Merging"
  | "Converting"
  | "Completed"
  | { Failed: string }
  | "Cancelled";

export type DownloadGroup = "active" | "history";

export type DirectFileType =
  | "mp4"
  | "mkv"
  | "avi"
  | "wmv"
  | "flv"
  | "webm"
  | "mov"
  | "rmvb";

export type FileType = "hls" | "dash" | DirectFileType;

export type DownloadMode = "hls" | "dash" | "direct";

export type DownloadSourceKind = "url" | "inline_dash_json";

export type HlsOutputMode = "single_stream" | "multi_track_bundle";

export type HlsMediaKind = "mpeg_ts" | "fmp4";

export type HlsPlaylistKind = "media" | "master";

export type HlsTrackType = "video" | "audio" | "subtitle";

export const DIRECT_FILE_TYPES: DirectFileType[] = [
  "mp4",
  "mkv",
  "avi",
  "wmv",
  "flv",
  "webm",
  "mov",
  "rmvb",
];

export const FILE_TYPE_OPTIONS: Array<{ value: FileType; label: string }> = [
  { value: "hls", label: "HLS" },
  { value: "dash", label: "DASH" },
  ...DIRECT_FILE_TYPES.map((value) => ({
    value,
    label: value.toUpperCase(),
  })),
];

export interface DirectDownloadInfo {
  parallel: boolean;
  total_bytes: number;
}

export interface DownloadTaskSummary {
  direct_parallel?: boolean;
  direct_info?: DirectDownloadInfo | null;
  id: string;
  filename: string;
  file_type: FileType;
  hls_output_mode: HlsOutputMode;
  hls_media_kind: HlsMediaKind;
  hls_selection: HlsTrackSelection | null;
  encryption_method: string | null;
  output_dir: string;
  status: DownloadStatus;
  total_segments: number;
  completed_segments: number;
  failed_segment_count: number;
  total_bytes: number;
  speed_bytes_per_sec: number;
  created_at: string;
  completed_at: string | null;
  updated_at: string;
  playback_available: boolean;
  file_path: string | null;
  is_live?: boolean;
}

export interface DownloadTaskSegmentState {
  segment_errors?: Record<number, string>;
  id: string;
  total_segments: number;
  completed_segment_indices: number[];
  failed_segment_indices: number[];
  updated_at: string;
}

export interface DownloadCounts {
  active_count: number;
  history_count: number;
}

export interface DownloadShutdownStatus {
  armed: boolean;
  pending: boolean;
  active_downloads: number;
  countdown_seconds: number;
}

export interface DownloadTaskPage {
  items: DownloadTaskSummary[];
  total: number;
  page: number;
  page_size: number;
}

export type ResumeDownloadAction = "resume" | "confirm_restart";

export interface ResumeDownloadCheckResult {
  action: ResumeDownloadAction;
  downloaded_bytes: number;
}

export interface DownloadProgressEvent {
  direct_info?: DirectDownloadInfo | null;
  id: string;
  status: DownloadStatus;
  group: DownloadGroup;
  completed_segments: number;
  total_segments: number;
  failed_segment_count: number;
  total_bytes: number;
  speed_bytes_per_sec: number;
  percentage: number;
  updated_at: string;
}

export interface CreateDownloadParams {
  direct_parallel?: boolean;
  url: string;
  source_kind?: DownloadSourceKind;
  source_text?: string;
  filename?: string;
  output_dir?: string;
  extra_headers?: string;
  download_mode?: DownloadMode;
  file_type?: FileType;
  hls_selection?: HlsTrackSelection;
}

export interface HlsTrackSelection {
  video_id?: string;
  audio_id?: string;
  subtitle_id?: string;
}

export interface HlsTrackOption {
  id: string;
  track_type: HlsTrackType;
  label: string;
  name: string | null;
  language: string | null;
  group_id: string | null;
  audio_group_id: string | null;
  subtitle_group_id: string | null;
  bandwidth: number | null;
  resolution: string | null;
  codecs: string | null;
  is_default: boolean;
  is_autoselect: boolean;
  is_forced: boolean;
}

export interface InspectHlsTracksParams {
  url: string;
  extra_headers?: string;
}

export interface InspectDashTracksParams {
  url: string;
  source_kind?: DownloadSourceKind;
  source_text?: string;
  extra_headers?: string;
}

export interface InspectHlsTracksResult {
  kind: HlsPlaylistKind;
  is_live: boolean;
  requires_selection: boolean;
  video_tracks: HlsTrackOption[];
  audio_tracks: HlsTrackOption[];
  subtitle_tracks: HlsTrackOption[];
  default_selection: HlsTrackSelection;
}

export interface OpenPlaybackSessionResponse {
  window_label: string;
  playback_url: string;
  playback_kind: PlaybackSourceKind;
  is_live?: boolean;
  session_token: string;
  filename: string;
  status: DownloadStatus;
}

export type PlaybackSourceKind = "hls" | "file" | "flv" | "mpegts";

export type ChromiumBrowser = "chrome" | "edge";

export interface ChromiumExtensionInstallResult {
  extension_path: string;
  manual_url: string;
}

export interface FirefoxExtensionInstallResult {
  extension_path: string;
  manual_url: string;
}

export interface MediaAnalysisStream {
  index: number;
  codec_type: string | null;
  codec_name: string | null;
  codec_long_name: string | null;
  profile: string | null;
  width: number | null;
  height: number | null;
  pix_fmt: string | null;
  level: number | null;
  r_frame_rate: string | null;
  avg_frame_rate: string | null;
  sample_rate: string | null;
  channels: number | null;
  channel_layout: string | null;
  bit_rate: string | null;
  duration: string | null;
  language: string | null;
}

export interface MediaAnalysisResult {
  file_path: string;
  format_name: string | null;
  format_long_name: string | null;
  duration: string | null;
  size: string | null;
  bit_rate: string | null;
  probe_score: number | null;
  stream_count: number;
  video_streams: MediaAnalysisStream[];
  audio_streams: MediaAnalysisStream[];
  subtitle_streams: MediaAnalysisStream[];
  other_streams: MediaAnalysisStream[];
  raw_json: string;
}

export function isDirectFileType(
  fileType: FileType | null | undefined
): fileType is DirectFileType {
  return fileType !== undefined && fileType !== null && fileType !== "hls" && fileType !== "dash";
}

export function parseFileType(value: string | null | undefined): FileType | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "hls") {
    return "hls";
  }
  if (normalized === "dash") {
    return "dash";
  }

  return DIRECT_FILE_TYPES.find((fileType) => fileType === normalized);
}

export function inferDirectFileTypeFromUrl(
  url: string | null | undefined
): DirectFileType | undefined {
  if (!url) {
    return undefined;
  }

  const candidates: string[] = [];
  const rawUrl = url.trim();

  try {
    const parsed = new URL(rawUrl);
    candidates.push(parsed.pathname);

    for (const key of ["filename", "file", "name", "title", "videoTitle"]) {
      const value = parsed.searchParams.get(key);
      if (value) {
        candidates.push(value);
      }
    }
  } catch {
    candidates.push(rawUrl);
  }

  candidates.push(rawUrl);

  for (const candidate of candidates) {
    const match = candidate.match(/\.(mp4|mkv|avi|wmv|flv|webm|mov|rmvb)(?:$|[?#])/i);
    const fileType = parseFileType(match?.[1]);
    if (fileType && isDirectFileType(fileType)) {
      return fileType;
    }
  }

  return undefined;
}

export function getFileTypeLabel(fileType: FileType): string {
  if (fileType === "hls") return "HLS";
  if (fileType === "dash") return "DASH";
  return fileType.toUpperCase();
}

export function supportsProgressivePlayback(fileType: FileType): boolean {
  return fileType === "mp4" || fileType === "webm";
}

export function canOpenInProgressPlayback(
  task: Pick<
    DownloadTaskSummary,
    "file_type" | "status" | "playback_available" | "is_live"
  >
): boolean {
  if (!task.playback_available) {
    return false;
  }

  const isInProgress =
    task.status === "Downloading" || task.status === "Paused";

  if (!isInProgress) {
    return task.status === "Completed";
  }

  // Live recordings can always be played while recording: FLV streams through
  // mpegts.js (tailing) and HLS through its growing local playlist.
  if (task.is_live) {
    return true;
  }

  return task.file_type === "hls" || supportsProgressivePlayback(task.file_type);
}

// ===================== Live recording =====================

export type LiveProtocol = "flv" | "hls";

export type LiveHlsMediaKind = "mpeg_ts" | "fmp4";

export type LiveRecordStatus =
  | "Recording"
  | "Paused"
  | "Recorded"
  | { Failed: string }
  | "Cancelled";

export type LiveGroup = "active" | "history";

export interface LiveRecordSummary {
  id: string;
  filename: string;
  protocol: LiveProtocol;
  url: string;
  output_dir: string;
  status: LiveRecordStatus;
  total_bytes: number;
  speed_bytes_per_sec: number;
  duration_ms: number;
  created_at: string;
  completed_at: string | null;
  updated_at: string;
  file_path: string | null;
  temp_dir?: string | null;
  hls_media_kind?: LiveHlsMediaKind | null;
  segment_count?: number;
  split?: LiveSplitConfig | null;
  part_paths?: string[];
  record_dir?: string | null;
}

export interface LiveRecordCounts {
  active_count: number;
  history_count: number;
}

export interface LiveRecordPage {
  items: LiveRecordSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface LiveProgressEvent {
  id: string;
  status: LiveRecordStatus;
  group: LiveGroup;
  total_bytes: number;
  speed_bytes_per_sec: number;
  duration_ms: number;
  updated_at: string;
}

/** 直播录制分段阈值：任一先达到即切分；两项均为空视为不分段。 */
export interface LiveSplitConfig {
  size_mb?: number | null;
  duration_min?: number | null;
}

export interface CreateLiveRecordParams {
  url: string;
  filename?: string;
  output_dir?: string;
  extra_headers?: string;
  protocol?: LiveProtocol;
  split?: LiveSplitConfig | null;
}

export function isLiveRecordActive(status: LiveRecordStatus): boolean {
  return status === "Recording" || status === "Paused";
}

export function liveRecordStatusToDownloadStatus(
  status: LiveRecordStatus
): DownloadStatus {
  if (status === "Recording") return "Downloading";
  if (status === "Paused") return "Paused";
  if (status === "Recorded") return "Completed";
  if (status === "Cancelled") return "Cancelled";
  return { Failed: status.Failed };
}

export function liveRecordToDownloadSummary(
  live: LiveRecordSummary
): DownloadTaskSummary {
  const isHls = live.protocol === "hls";
  return {
    id: live.id,
    filename: live.filename,
    file_type: isHls ? "hls" : "flv",
    hls_output_mode: "single_stream",
    hls_media_kind: live.hls_media_kind ?? "mpeg_ts",
    hls_selection: null,
    encryption_method: null,
    output_dir: live.output_dir,
    status: liveRecordStatusToDownloadStatus(live.status),
    total_segments: 0,
    completed_segments: 0,
    failed_segment_count: 0,
    total_bytes: live.total_bytes,
    speed_bytes_per_sec: live.speed_bytes_per_sec,
    created_at: live.created_at,
    completed_at: live.completed_at,
    updated_at: live.updated_at,
    playback_available:
      live.status === "Recording" ||
      live.status === "Paused" ||
      (live.status === "Recorded" && Boolean(live.file_path)),
    file_path: live.file_path,
    is_live: true,
  };
}

export function deriveFilenameFromUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { title?: unknown };
      if (typeof parsed.title === "string" && parsed.title.trim()) {
        return normalizeDownloadFilename(parsed.title);
      }
    } catch {
      // fall through to URL parsing
    }
    return "";
  }

  try {
    const parsed = new URL(trimmed);
    const queryKeys = ["title", "name", "filename", "file", "videoTitle"];

    const rawName =
      queryKeys
        .map((key) => parsed.searchParams.get(key))
        .find((value) => value && value.trim()) ??
      parsed.pathname.split("/").filter(Boolean).at(-1) ??
      "";

    return normalizeDownloadFilename(rawName);
  } catch {
    return "";
  }
}

export interface FilenameCleanupResult {
  filename: string;
  matched: boolean;
}

export interface FilenameCleanupRegexCaptureGroup {
  index: number;
  value: string;
}

export function applyFilenameCleanupRulesWithMatch(
  name: string,
  rules: FilenameCleanupRule[],
  sourceUrl?: string
): FilenameCleanupResult {
  let result = name;
  let matched = false;
  const sourceSite = filenameCleanupSourceSite(sourceUrl ?? "");

  for (const rule of rules) {
    const pattern = rule.pattern.trim();
    if (!rule.enabled || !pattern) {
      continue;
    }
    if (!filenameCleanupRuleMatchesSource(rule, sourceSite)) {
      continue;
    }

    if (rule.match_type === "regex") {
      try {
        const testExpression = new RegExp(
          pattern,
          rule.case_sensitive ? "" : "i"
        );
        const expression = new RegExp(
          pattern,
          rule.case_sensitive ? "g" : "gi"
        );
        matched ||= testExpression.test(result);
        result = result.replace(expression, rule.replacement);
      } catch {
        // Invalid patterns are rejected before saving and ignored defensively here.
      }
      continue;
    }

    if (rule.match_type === "suffix") {
      const lowerResult = result.toLowerCase();
      const lowerPattern = pattern.toLowerCase();
      if (
        rule.case_sensitive
          ? result.endsWith(pattern)
          : lowerResult.endsWith(lowerPattern)
      ) {
        matched = true;
        result = result.slice(0, result.length - pattern.length) + rule.replacement;
      }
      continue;
    }

    for (const variant of filenameCleanupContainsPatternVariants(pattern)) {
      const testExpression = new RegExp(
        escapeRegExp(variant),
        rule.case_sensitive ? "" : "i"
      );
      if (!testExpression.test(result)) {
        continue;
      }
      matched = true;
      result = result.replace(
        new RegExp(
          escapeRegExp(variant),
          rule.case_sensitive ? "g" : "gi"
        ),
        () => rule.replacement
      );
    }
  }

  return {
    filename: normalizeDownloadFilename(result),
    matched,
  };
}

export function getFilenameCleanupRegexCaptureGroups(
  name: string,
  rule: FilenameCleanupRule,
  sourceUrl?: string
): FilenameCleanupRegexCaptureGroup[] {
  if (
    !rule.enabled ||
    rule.match_type !== "regex" ||
    !rule.pattern.trim() ||
    !filenameCleanupRuleMatchesSource(
      rule,
      filenameCleanupSourceSite(sourceUrl ?? "")
    )
  ) {
    return [];
  }

  try {
    const match = new RegExp(
      rule.pattern.trim(),
      rule.case_sensitive ? "" : "i"
    ).exec(name);
    if (!match) {
      return [];
    }
    return match.slice(1).map((value, index) => ({
      index: index + 1,
      value: value ?? "",
    }));
  } catch {
    return [];
  }
}

export function applyFilenameCleanupRules(
  name: string,
  rules: FilenameCleanupRule[],
  sourceUrl?: string
): string {
  return applyFilenameCleanupRulesWithMatch(name, rules, sourceUrl).filename;
}

export function cleanDownloadUrlAfterFilenameCleanup(
  url: string,
  rules: FilenameCleanupRule[],
  sourceUrl?: string
): string {
  const cleanupSourceUrl = sourceUrl?.trim() || url;
  const result = applyFilenameCleanupRulesWithMatch(
    deriveFilenameFromUrl(url),
    rules,
    cleanupSourceUrl
  );
  return result.matched ? removeTitleQueryParameter(url) : url;
}

export function resolveFilenameCleanupSourceUrl(
  url: string,
  extraHeaders?: string
): string {
  const headers = new Map<string, string>();
  for (const line of (extraHeaders ?? "").split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator <= 0) {
      continue;
    }
    const name = line.slice(0, separator).trim().toLowerCase();
    const value = normalizeCleanupHeaderValue(
      line.slice(separator + 1)
    );
    if (name && value) {
      headers.set(name, value);
    }
  }
  return headers.get("referer") || headers.get("origin") || url;
}

export function removeTitleQueryParameter(url: string): string {
  try {
    const parsed = new URL(url.trim());
    let removed = false;
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (key.toLowerCase() === "title") {
        parsed.searchParams.delete(key);
        removed = true;
      }
    }
    return removed ? parsed.toString() : url;
  } catch {
    return url;
  }
}

export type FilenameCleanupValidationIssue =
  | "pattern"
  | "site"
  | "regex"
  | null;

export function validateFilenameCleanupRule(
  rule: FilenameCleanupRule
): FilenameCleanupValidationIssue {
  if (!rule.enabled) {
    return null;
  }
  const pattern = rule.pattern.trim();
  if (!pattern) {
    return "pattern";
  }
  if (rule.scope === "site" && !normalizeFilenameCleanupSite(rule.site ?? "")) {
    return "site";
  }
  if (rule.match_type === "regex") {
    try {
      new RegExp(pattern, rule.case_sensitive ? "g" : "gi");
    } catch {
      return "regex";
    }
  }
  return null;
}

export function normalizeFilenameCleanupSite(value: string): string {
  const trimmed = normalizeCleanupHeaderValue(value);
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed);
    return normalizeHostname(parsed.hostname);
  } catch {
    const hostname = trimmed.split(/[/?#]/, 1)[0]?.split(":", 1)[0] ?? "";
    return normalizeHostname(hostname);
  }
}

export function filenameCleanupSourceSite(sourceUrl: string): string {
  const trimmed = sourceUrl.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      for (const key of ["base_url", "url"]) {
        const value = parsed[key];
        if (typeof value === "string") {
          const site = filenameCleanupSourceSite(value);
          if (site) {
            return site;
          }
        }
      }
    } catch {
      return "";
    }
    return "";
  }

  try {
    return normalizeHostname(new URL(trimmed).hostname);
  } catch {
    return normalizeFilenameCleanupSite(trimmed);
  }
}

function normalizeHostname(value: string): string {
  return value
    .trim()
    .replace(/^\*\./, "")
    .replace(/^\.+|\.+$/g, "")
    .replace(/^www\./, "")
    .toLowerCase();
}

function normalizeCleanupHeaderValue(value: string): string {
  return value
    .trim()
    .replace(/\\:/g, ":")
    .replace(/\\+$/g, "")
    .trim();
}

function filenameCleanupContainsPatternVariants(pattern: string): string[] {
  const variants = new Set([pattern]);
  if (pattern.includes(" | ")) {
    variants.add(pattern.replace(/ \| /g, " _ "));
  }
  if (pattern.includes(" _ ")) {
    variants.add(pattern.replace(/ _ /g, " | "));
  }
  return [...variants];
}

function filenameCleanupHostMatches(host: string, site: string): boolean {
  return Boolean(host) && host === site;
}

function filenameCleanupRuleMatchesSource(
  rule: FilenameCleanupRule,
  sourceSite: string
): boolean {
  if (rule.scope !== "site") {
    return true;
  }
  const site = normalizeFilenameCleanupSite(rule.site ?? "");
  return Boolean(site) && filenameCleanupHostMatches(sourceSite, site);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeDownloadFilename(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";

  const sanitized = Array.from(trimmed)
    .map((char) =>
      /[<>:"/\\|?*]/.test(char) || char.charCodeAt(0) <= 0x1f ? "_" : char
    )
    .join("")
    .replace(/^\.+|\.+$/g, "")
    .trim();

  if (!sanitized) return "";

  const lower = sanitized.toLowerCase();
  if (lower.endsWith(".m3u8")) {
    return sanitized.slice(0, -5);
  }
  if (lower.endsWith(".mpd")) {
    return sanitized.slice(0, -4);
  }
  if (lower.endsWith(".ts")) {
    return sanitized.slice(0, -3);
  }

  for (const fileType of DIRECT_FILE_TYPES) {
    const suffix = `.${fileType}`;
    if (lower.endsWith(suffix)) {
      return sanitized.slice(0, -suffix.length);
    }
  }

  return sanitized;
}
