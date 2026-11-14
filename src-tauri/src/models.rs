use chrono::{DateTime, Utc};
use regex::RegexBuilder;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub type DownloadId = String;
pub type RequestHeaders = HashMap<String, String>;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FileType {
    Hls,
    Dash,
    Mp4,
    Mkv,
    Avi,
    Wmv,
    Flv,
    Webm,
    Mov,
    Rmvb,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DownloadMode {
    Hls,
    Dash,
    Direct,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum DownloadSourceKind {
    #[default]
    Url,
    InlineDashJson,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum HlsOutputMode {
    #[default]
    SingleStream,
    MultiTrackBundle,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum HlsMediaKind {
    #[default]
    MpegTs,
    Fmp4,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum HlsPlaylistKind {
    Media,
    Master,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum HlsTrackType {
    Video,
    Audio,
    Subtitle,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(default)]
pub struct HlsTrackSelection {
    pub video_id: Option<String>,
    pub audio_id: Option<String>,
    pub subtitle_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HlsTrackOption {
    pub id: String,
    pub track_type: HlsTrackType,
    pub label: String,
    pub name: Option<String>,
    pub language: Option<String>,
    pub group_id: Option<String>,
    pub audio_group_id: Option<String>,
    pub subtitle_group_id: Option<String>,
    pub bandwidth: Option<u64>,
    pub resolution: Option<String>,
    pub codecs: Option<String>,
    pub is_default: bool,
    pub is_autoselect: bool,
    pub is_forced: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InspectHlsTracksParams {
    pub url: String,
    pub extra_headers: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InspectDashTracksParams {
    pub url: String,
    #[serde(default)]
    pub source_kind: DownloadSourceKind,
    #[serde(default)]
    pub source_text: Option<String>,
    pub extra_headers: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InspectHlsTracksResult {
    pub kind: HlsPlaylistKind,
    #[serde(default)]
    pub is_live: bool,
    pub requires_selection: bool,
    pub video_tracks: Vec<HlsTrackOption>,
    pub audio_tracks: Vec<HlsTrackOption>,
    pub subtitle_tracks: Vec<HlsTrackOption>,
    pub default_selection: HlsTrackSelection,
}

impl Default for FileType {
    fn default() -> Self {
        FileType::Hls
    }
}

impl FileType {
    pub fn is_direct_download(self) -> bool {
        !matches!(self, FileType::Hls | FileType::Dash)
    }

    pub fn supports_progressive_playback(self) -> bool {
        matches!(self, FileType::Mp4 | FileType::Webm)
    }

    pub fn default_extension(self) -> Option<&'static str> {
        match self {
            FileType::Hls | FileType::Dash => None,
            FileType::Mp4 => Some("mp4"),
            FileType::Mkv => Some("mkv"),
            FileType::Avi => Some("avi"),
            FileType::Wmv => Some("wmv"),
            FileType::Flv => Some("flv"),
            FileType::Webm => Some("webm"),
            FileType::Mov => Some("mov"),
            FileType::Rmvb => Some("rmvb"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DownloadStatus {
    Pending,
    Downloading,
    Paused,
    Merging,
    Converting,
    Completed,
    Failed(String),
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectDownloadInfo {
    pub parallel: bool,
    pub total_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadTask {
    pub id: DownloadId,
    pub url: String,
    #[serde(default)]
    pub source_kind: DownloadSourceKind,
    #[serde(default)]
    pub source_text: Option<String>,
    pub filename: String,
    #[serde(default)]
    pub file_type: FileType,
    #[serde(default)]
    pub direct_parallel: bool,
    #[serde(default)]
    pub direct_info: Option<DirectDownloadInfo>,
    #[serde(default)]
    pub hls_output_mode: HlsOutputMode,
    #[serde(default)]
    pub hls_media_kind: HlsMediaKind,
    #[serde(default)]
    pub hls_selection: Option<HlsTrackSelection>,
    #[serde(default)]
    pub encryption_method: Option<String>,
    pub output_dir: String,
    #[serde(default)]
    pub extra_headers: Option<String>,
    pub status: DownloadStatus,
    pub total_segments: usize,
    pub completed_segments: usize,
    #[serde(default)]
    pub completed_segment_indices: Vec<usize>,
    #[serde(default)]
    pub failed_segment_indices: Vec<usize>,
    #[serde(default)]
    pub segment_uris: Vec<String>,
    #[serde(default)]
    pub segment_durations: Vec<f32>,
    #[serde(default)]
    pub hls_init_segments: Vec<HlsInitSegmentInfo>,
    #[serde(default)]
    pub segment_init_indices: Vec<Option<usize>>,
    pub total_bytes: u64,
    pub speed_bytes_per_sec: u64,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub updated_at: Option<DateTime<Utc>>,
    #[serde(default = "default_playback_available")]
    pub playback_available: bool,
    pub file_path: Option<String>,
}

impl DownloadTask {
    pub fn touch(&mut self) -> DateTime<Utc> {
        let now = Utc::now();
        self.updated_at = Some(now);
        now
    }

    pub fn last_updated_at(&self) -> DateTime<Utc> {
        self.updated_at
            .clone()
            .or_else(|| self.completed_at.clone())
            .unwrap_or(self.created_at)
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadProgressEvent {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub direct_info: Option<DirectDownloadInfo>,
    pub id: DownloadId,
    pub status: DownloadStatus,
    pub group: DownloadGroup,
    pub completed_segments: usize,
    pub total_segments: usize,
    pub failed_segment_count: usize,
    pub total_bytes: u64,
    pub speed_bytes_per_sec: u64,
    pub percentage: f64,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateDownloadParams {
    #[serde(default)]
    pub direct_parallel: bool,
    pub url: String,
    #[serde(default)]
    pub source_kind: DownloadSourceKind,
    #[serde(default)]
    pub source_text: Option<String>,
    pub filename: Option<String>,
    pub output_dir: Option<String>,
    pub extra_headers: Option<String>,
    #[serde(default)]
    pub download_mode: Option<DownloadMode>,
    #[serde(default)]
    pub file_type: Option<FileType>,
    #[serde(default)]
    pub hls_selection: Option<HlsTrackSelection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ProxySettings {
    pub enabled: bool,
    pub url: String,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FilenameCleanupScope {
    #[default]
    Global,
    Site,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FilenameCleanupMatchType {
    #[default]
    Contains,
    Suffix,
    Regex,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct FilenameCleanupRule {
    pub id: String,
    pub enabled: bool,
    pub scope: FilenameCleanupScope,
    pub site: String,
    pub match_type: FilenameCleanupMatchType,
    pub pattern: String,
    pub replacement: String,
    pub case_sensitive: bool,
}

impl Default for FilenameCleanupRule {
    fn default() -> Self {
        Self {
            id: String::new(),
            enabled: true,
            scope: FilenameCleanupScope::Global,
            site: String::new(),
            match_type: FilenameCleanupMatchType::Contains,
            pattern: String::new(),
            replacement: String::new(),
            case_sensitive: false,
        }
    }
}

pub const MAX_FILENAME_CLEANUP_RULES: usize = 100;
pub const MAX_FILENAME_CLEANUP_PATTERN_CHARS: usize = 512;
pub const MAX_FILENAME_CLEANUP_REPLACEMENT_CHARS: usize = 512;
pub const MAX_FILENAME_CLEANUP_SITE_CHARS: usize = 253;

pub const DEFAULT_DOWNLOAD_CONCURRENCY: usize = 8;
pub const MIN_DOWNLOAD_CONCURRENCY: usize = 1;
pub const MAX_DOWNLOAD_CONCURRENCY: usize = 10000;
pub const DEFAULT_DOWNLOAD_SPEED_LIMIT_KBPS: u64 = 0;
pub const DEFAULT_DOWNLOAD_SMART_SPEED_LIMIT_THRESHOLD: usize = 3;
pub const MIN_DOWNLOAD_SMART_SPEED_LIMIT_THRESHOLD: usize = 1;
pub const DEFAULT_MERGE_FAILED_SEGMENT_LIMIT: usize = 30;
pub const MAX_MERGE_FAILED_SEGMENT_LIMIT: usize = 1000;
pub const DEFAULT_PREVIEW_COLUMNS: usize = 3;
pub const MIN_PREVIEW_COLUMNS: usize = 1;
pub const MAX_PREVIEW_COLUMNS: usize = 12;
pub const DEFAULT_PREVIEW_COUNT: usize = 9;
pub const MIN_PREVIEW_COUNT: usize = 9;
pub const MAX_PREVIEW_COUNT: usize = 99;
pub const DEFAULT_PREVIEW_THUMBNAIL_WIDTH: u32 = 320;
pub const MIN_PREVIEW_THUMBNAIL_WIDTH: u32 = 320;
pub const MAX_PREVIEW_THUMBNAIL_WIDTH: u32 = 1920;
pub const DEFAULT_PREVIEW_JPEG_QUALITY: u8 = 4;
pub const MIN_PREVIEW_JPEG_QUALITY: u8 = 2;
pub const MAX_PREVIEW_JPEG_QUALITY: u8 = 10;
pub const DEFAULT_HISTORY_PAGE_SIZE: usize = 50;
pub const HISTORY_PAGE_SIZE_OPTIONS: [usize; 5] = [10, 20, 50, 100, 200];

/// 默认 User-Agent，按操作系统给出更贴近真实浏览器的标识。
pub fn default_user_agent() -> &'static str {
    if cfg!(target_os = "windows") {
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) M3U8Quicker/0.1"
    } else if cfg!(target_os = "macos") {
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) M3U8Quicker/0.1"
    } else {
        "Mozilla/5.0 (X11; Linux x86_64) M3U8Quicker/0.1"
    }
}

// HTTP 超时（秒），下载与录播共用同一 HTTP 客户端。仅约束下限，无上限。
pub const DEFAULT_METADATA_TIMEOUT_SECS: u64 = 5;
pub const MIN_METADATA_TIMEOUT_SECS: u64 = 1;
pub const DEFAULT_SEGMENT_TIMEOUT_SECS: u64 = 5 * 60;
pub const MIN_SEGMENT_TIMEOUT_SECS: u64 = 1;
pub const DEFAULT_MP4_TIMEOUT_SECS: u64 = 60 * 60;
pub const MIN_MP4_TIMEOUT_SECS: u64 = 1;

// 录播节奏参数。仅约束下限，无上限。
pub const DEFAULT_HLS_REFRESH_MIN_MS: u64 = 800;
pub const MIN_HLS_REFRESH_MIN_MS: u64 = 1;
pub const DEFAULT_HLS_REFRESH_MAX_MS: u64 = 6_000;
pub const MIN_HLS_REFRESH_MAX_MS: u64 = 1;
pub const DEFAULT_HLS_PLAYLIST_TIMEOUT_SECS: u64 = 15;
pub const MIN_HLS_PLAYLIST_TIMEOUT_SECS: u64 = 1;
pub const DEFAULT_LIVE_SEGMENT_TIMEOUT_SECS: u64 = 60;
pub const MIN_LIVE_SEGMENT_TIMEOUT_SECS: u64 = 1;
pub const DEFAULT_LIVE_RETRY_HLS_MS: u64 = 1_000;
pub const MIN_LIVE_RETRY_HLS_MS: u64 = 1;
pub const DEFAULT_LIVE_RETRY_FLV_MS: u64 = 300;
pub const MIN_LIVE_RETRY_FLV_MS: u64 = 1;

// 直播录制分段参数。仅约束下限，防止过小阈值导致疯狂切分。
pub const DEFAULT_LIVE_SPLIT_SIZE_MB: u64 = 1024;
pub const MIN_LIVE_SPLIT_SIZE_MB: u64 = 10;
pub const DEFAULT_LIVE_SPLIT_DURATION_MIN: u64 = 60;
pub const MIN_LIVE_SPLIT_DURATION_MIN: u64 = 1;

pub fn normalize_download_concurrency(value: usize) -> usize {
    value.clamp(MIN_DOWNLOAD_CONCURRENCY, MAX_DOWNLOAD_CONCURRENCY)
}

pub fn normalize_download_speed_limit_kbps(value: u64) -> u64 {
    value
}

pub fn normalize_download_smart_speed_limit_threshold(value: usize) -> usize {
    value.max(MIN_DOWNLOAD_SMART_SPEED_LIMIT_THRESHOLD)
}

pub fn normalize_merge_failed_segment_limit(value: usize) -> usize {
    value.min(MAX_MERGE_FAILED_SEGMENT_LIMIT)
}

pub fn normalize_preview_columns(value: usize) -> usize {
    value.clamp(MIN_PREVIEW_COLUMNS, MAX_PREVIEW_COLUMNS)
}

pub fn normalize_preview_count(value: usize) -> usize {
    value.clamp(MIN_PREVIEW_COUNT, MAX_PREVIEW_COUNT)
}

pub fn normalize_preview_thumbnail_width(value: u32) -> u32 {
    value.clamp(MIN_PREVIEW_THUMBNAIL_WIDTH, MAX_PREVIEW_THUMBNAIL_WIDTH)
}

pub fn normalize_preview_jpeg_quality(value: u8) -> u8 {
    value.clamp(MIN_PREVIEW_JPEG_QUALITY, MAX_PREVIEW_JPEG_QUALITY)
}

pub fn normalize_user_agent(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        default_user_agent().to_string()
    } else {
        trimmed.to_string()
    }
}

pub fn normalize_history_page_size(value: usize) -> usize {
    if HISTORY_PAGE_SIZE_OPTIONS.contains(&value) {
        value
    } else {
        DEFAULT_HISTORY_PAGE_SIZE
    }
}

pub fn normalize_metadata_timeout_secs(value: u64) -> u64 {
    value.max(MIN_METADATA_TIMEOUT_SECS)
}

pub fn normalize_segment_timeout_secs(value: u64) -> u64 {
    value.max(MIN_SEGMENT_TIMEOUT_SECS)
}

pub fn normalize_mp4_timeout_secs(value: u64) -> u64 {
    value.max(MIN_MP4_TIMEOUT_SECS)
}

pub fn normalize_hls_refresh_min_ms(value: u64) -> u64 {
    value.max(MIN_HLS_REFRESH_MIN_MS)
}

pub fn normalize_hls_refresh_max_ms(value: u64) -> u64 {
    value.max(MIN_HLS_REFRESH_MAX_MS)
}

pub fn normalize_hls_playlist_timeout_secs(value: u64) -> u64 {
    value.max(MIN_HLS_PLAYLIST_TIMEOUT_SECS)
}

pub fn normalize_live_segment_timeout_secs(value: u64) -> u64 {
    value.max(MIN_LIVE_SEGMENT_TIMEOUT_SECS)
}

pub fn normalize_live_retry_hls_ms(value: u64) -> u64 {
    value.max(MIN_LIVE_RETRY_HLS_MS)
}

pub fn normalize_live_retry_flv_ms(value: u64) -> u64 {
    value.max(MIN_LIVE_RETRY_FLV_MS)
}

pub fn normalize_live_split_size_mb(value: u64) -> u64 {
    value.max(MIN_LIVE_SPLIT_SIZE_MB)
}

pub fn normalize_live_split_duration_min(value: u64) -> u64 {
    value.max(MIN_LIVE_SPLIT_DURATION_MIN)
}

impl Default for ProxySettings {
    fn default() -> Self {
        let default_url = if cfg!(target_os = "macos") {
            "http://127.0.0.1:7890"
        } else {
            "http://127.0.0.1:10808"
        };

        Self {
            enabled: false,
            url: default_url.to_string(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(default)]
pub struct AppSettings {
    #[serde(default, deserialize_with = "crate::i18n::deserialize_saved_language")]
    pub language: Option<crate::i18n::AppLanguage>,
    pub default_download_dir: Option<String>,
    #[serde(default)]
    pub filename_cleanup_rules: Vec<FilenameCleanupRule>,
    pub proxy: ProxySettings,
    pub download_concurrency: usize,
    pub download_speed_limit_kbps: u64,
    #[serde(default)]
    pub download_smart_speed_limit_enabled: bool,
    #[serde(default = "default_download_smart_speed_limit_threshold")]
    pub download_smart_speed_limit_threshold: usize,
    #[serde(default = "default_merge_failed_segment_limit")]
    pub merge_failed_segment_limit: usize,
    pub preview_columns: usize,
    pub preview_count: usize,
    pub preview_thumbnail_width: u32,
    pub preview_jpeg_quality: u8,
    pub delete_ts_temp_dir_after_download: bool,
    pub convert_to_mp4: bool,
    #[serde(default = "default_ffmpeg_enabled")]
    pub ffmpeg_enabled: bool,
    pub ffmpeg_path: Option<String>,
    #[serde(default = "default_user_agent_owned")]
    pub user_agent: String,
    pub ignore_https_certificate_errors: bool,
    #[serde(default = "default_metadata_timeout_secs")]
    pub metadata_timeout_secs: u64,
    #[serde(default = "default_segment_timeout_secs")]
    pub segment_timeout_secs: u64,
    #[serde(default = "default_mp4_timeout_secs")]
    pub mp4_timeout_secs: u64,
    #[serde(default = "default_hls_refresh_min_ms")]
    pub hls_refresh_min_ms: u64,
    #[serde(default = "default_hls_refresh_max_ms")]
    pub hls_refresh_max_ms: u64,
    #[serde(default = "default_hls_playlist_timeout_secs")]
    pub hls_playlist_timeout_secs: u64,
    #[serde(default = "default_live_segment_timeout_secs")]
    pub live_segment_timeout_secs: u64,
    #[serde(default = "default_live_retry_hls_ms")]
    pub live_retry_hls_ms: u64,
    #[serde(default = "default_live_retry_flv_ms")]
    pub live_retry_flv_ms: u64,
    #[serde(default)]
    pub live_split_enabled: bool,
    #[serde(default = "default_live_split_size_mb")]
    pub live_split_size_mb: u64,
    #[serde(default = "default_live_split_duration_min")]
    pub live_split_duration_min: u64,
    #[serde(default = "default_history_page_size")]
    pub history_page_size: usize,
    #[serde(default = "default_close_to_tray")]
    pub close_to_tray: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            language: None,
            default_download_dir: None,
            filename_cleanup_rules: Vec::new(),
            proxy: ProxySettings::default(),
            download_concurrency: DEFAULT_DOWNLOAD_CONCURRENCY,
            download_speed_limit_kbps: DEFAULT_DOWNLOAD_SPEED_LIMIT_KBPS,
            download_smart_speed_limit_enabled: false,
            download_smart_speed_limit_threshold: DEFAULT_DOWNLOAD_SMART_SPEED_LIMIT_THRESHOLD,
            merge_failed_segment_limit: DEFAULT_MERGE_FAILED_SEGMENT_LIMIT,
            preview_columns: DEFAULT_PREVIEW_COLUMNS,
            preview_count: DEFAULT_PREVIEW_COUNT,
            preview_thumbnail_width: DEFAULT_PREVIEW_THUMBNAIL_WIDTH,
            preview_jpeg_quality: DEFAULT_PREVIEW_JPEG_QUALITY,
            delete_ts_temp_dir_after_download: true,
            convert_to_mp4: true,
            ffmpeg_enabled: true,
            ffmpeg_path: None,
            user_agent: default_user_agent().to_string(),
            ignore_https_certificate_errors: false,
            metadata_timeout_secs: DEFAULT_METADATA_TIMEOUT_SECS,
            segment_timeout_secs: DEFAULT_SEGMENT_TIMEOUT_SECS,
            mp4_timeout_secs: DEFAULT_MP4_TIMEOUT_SECS,
            hls_refresh_min_ms: DEFAULT_HLS_REFRESH_MIN_MS,
            hls_refresh_max_ms: DEFAULT_HLS_REFRESH_MAX_MS,
            hls_playlist_timeout_secs: DEFAULT_HLS_PLAYLIST_TIMEOUT_SECS,
            live_segment_timeout_secs: DEFAULT_LIVE_SEGMENT_TIMEOUT_SECS,
            live_retry_hls_ms: DEFAULT_LIVE_RETRY_HLS_MS,
            live_retry_flv_ms: DEFAULT_LIVE_RETRY_FLV_MS,
            live_split_enabled: false,
            live_split_size_mb: DEFAULT_LIVE_SPLIT_SIZE_MB,
            live_split_duration_min: DEFAULT_LIVE_SPLIT_DURATION_MIN,
            history_page_size: DEFAULT_HISTORY_PAGE_SIZE,
            close_to_tray: true,
        }
    }
}

fn default_history_page_size() -> usize {
    DEFAULT_HISTORY_PAGE_SIZE
}

fn default_download_smart_speed_limit_threshold() -> usize {
    DEFAULT_DOWNLOAD_SMART_SPEED_LIMIT_THRESHOLD
}

fn default_merge_failed_segment_limit() -> usize {
    DEFAULT_MERGE_FAILED_SEGMENT_LIMIT
}

fn default_close_to_tray() -> bool {
    true
}

fn default_ffmpeg_enabled() -> bool {
    true
}

fn default_user_agent_owned() -> String {
    default_user_agent().to_string()
}

fn default_metadata_timeout_secs() -> u64 {
    DEFAULT_METADATA_TIMEOUT_SECS
}

fn default_segment_timeout_secs() -> u64 {
    DEFAULT_SEGMENT_TIMEOUT_SECS
}

fn default_mp4_timeout_secs() -> u64 {
    DEFAULT_MP4_TIMEOUT_SECS
}

fn default_hls_refresh_min_ms() -> u64 {
    DEFAULT_HLS_REFRESH_MIN_MS
}

fn default_hls_refresh_max_ms() -> u64 {
    DEFAULT_HLS_REFRESH_MAX_MS
}

fn default_hls_playlist_timeout_secs() -> u64 {
    DEFAULT_HLS_PLAYLIST_TIMEOUT_SECS
}

fn default_live_segment_timeout_secs() -> u64 {
    DEFAULT_LIVE_SEGMENT_TIMEOUT_SECS
}

fn default_live_retry_hls_ms() -> u64 {
    DEFAULT_LIVE_RETRY_HLS_MS
}

fn default_live_split_size_mb() -> u64 {
    DEFAULT_LIVE_SPLIT_SIZE_MB
}

fn default_live_split_duration_min() -> u64 {
    DEFAULT_LIVE_SPLIT_DURATION_MIN
}

fn default_live_retry_flv_ms() -> u64 {
    DEFAULT_LIVE_RETRY_FLV_MS
}

impl AppSettings {
    pub fn sanitize(&mut self) {
        self.download_concurrency = normalize_download_concurrency(self.download_concurrency);
        self.download_speed_limit_kbps =
            normalize_download_speed_limit_kbps(self.download_speed_limit_kbps);
        self.download_smart_speed_limit_threshold =
            normalize_download_smart_speed_limit_threshold(
                self.download_smart_speed_limit_threshold,
            );
        self.merge_failed_segment_limit =
            normalize_merge_failed_segment_limit(self.merge_failed_segment_limit);
        if self.download_smart_speed_limit_enabled && self.download_speed_limit_kbps == 0 {
            self.download_smart_speed_limit_enabled = false;
        }
        self.preview_columns = normalize_preview_columns(self.preview_columns);
        self.preview_count = normalize_preview_count(self.preview_count);
        self.preview_thumbnail_width =
            normalize_preview_thumbnail_width(self.preview_thumbnail_width);
        self.preview_jpeg_quality = normalize_preview_jpeg_quality(self.preview_jpeg_quality);
        self.user_agent = normalize_user_agent(&self.user_agent);
        self.metadata_timeout_secs = normalize_metadata_timeout_secs(self.metadata_timeout_secs);
        self.segment_timeout_secs = normalize_segment_timeout_secs(self.segment_timeout_secs);
        self.mp4_timeout_secs = normalize_mp4_timeout_secs(self.mp4_timeout_secs);
        self.hls_refresh_min_ms = normalize_hls_refresh_min_ms(self.hls_refresh_min_ms);
        self.hls_refresh_max_ms = normalize_hls_refresh_max_ms(self.hls_refresh_max_ms);
        if self.hls_refresh_max_ms < self.hls_refresh_min_ms {
            self.hls_refresh_max_ms = self.hls_refresh_min_ms;
        }
        self.hls_playlist_timeout_secs =
            normalize_hls_playlist_timeout_secs(self.hls_playlist_timeout_secs);
        self.live_segment_timeout_secs =
            normalize_live_segment_timeout_secs(self.live_segment_timeout_secs);
        self.live_retry_hls_ms = normalize_live_retry_hls_ms(self.live_retry_hls_ms);
        self.live_retry_flv_ms = normalize_live_retry_flv_ms(self.live_retry_flv_ms);
        self.live_split_size_mb = normalize_live_split_size_mb(self.live_split_size_mb);
        self.live_split_duration_min =
            normalize_live_split_duration_min(self.live_split_duration_min);
        self.history_page_size = normalize_history_page_size(self.history_page_size);
        sanitize_filename_cleanup_rules(&mut self.filename_cleanup_rules);
    }
}

pub struct FilenameCleanupResult {
    pub filename: String,
    pub matched: bool,
}

pub fn apply_filename_cleanup_rules_with_match(
    name: &str,
    rules: &[FilenameCleanupRule],
    source_url: Option<&str>,
) -> FilenameCleanupResult {
    let mut result = name.to_string();
    let mut matched = false;
    let source_host = source_url.and_then(filename_cleanup_source_host);

    for rule in rules.iter().filter(|rule| rule.enabled) {
        if rule.pattern.is_empty() {
            continue;
        }
        if rule.scope == FilenameCleanupScope::Site {
            let site = normalize_filename_cleanup_site(&rule.site);
            if site.is_empty()
                || !source_host
                    .as_deref()
                    .is_some_and(|host| filename_cleanup_host_matches(host, &site))
            {
                continue;
            }
        }

        result = match rule.match_type {
            FilenameCleanupMatchType::Contains => {
                for pattern_variant in
                    filename_cleanup_contains_pattern_variants(&rule.pattern)
                {
                    if contains_matching_text(
                        &result,
                        &pattern_variant,
                        rule.case_sensitive,
                    ) {
                        matched = true;
                        result = replace_all_matching_text(
                            &result,
                            &pattern_variant,
                            &rule.replacement,
                            rule.case_sensitive,
                        );
                    }
                }
                result
            }
            FilenameCleanupMatchType::Suffix => {
                strip_matching_suffix(&result, &rule.pattern, rule.case_sensitive)
                    .map(|prefix| {
                        matched = true;
                        format!("{prefix}{}", rule.replacement)
                    })
                    .unwrap_or(result)
            }
            FilenameCleanupMatchType::Regex => RegexBuilder::new(&rule.pattern)
                .case_insensitive(!rule.case_sensitive)
                .build()
                .map(|regex| {
                    matched |= regex.is_match(&result);
                    regex.replace_all(&result, rule.replacement.as_str()).into_owned()
                })
                .unwrap_or(result),
        };
    }

    FilenameCleanupResult {
        filename: result,
        matched,
    }
}

#[cfg(test)]
pub fn apply_filename_cleanup_rules(
    name: &str,
    rules: &[FilenameCleanupRule],
    source_url: Option<&str>,
) -> String {
    apply_filename_cleanup_rules_with_match(name, rules, source_url).filename
}

fn sanitize_filename_cleanup_rules(rules: &mut Vec<FilenameCleanupRule>) {
    rules.truncate(MAX_FILENAME_CLEANUP_RULES);
    let mut seen_ids = std::collections::HashSet::new();

    for (index, rule) in rules.iter_mut().enumerate() {
        rule.id = rule.id.trim().to_string();
        if rule.id.is_empty() || !seen_ids.insert(rule.id.clone()) {
            rule.id = format!("cleanup-{}", index + 1);
            seen_ids.insert(rule.id.clone());
        }
        rule.pattern = rule
            .pattern
            .trim()
            .chars()
            .take(MAX_FILENAME_CLEANUP_PATTERN_CHARS)
            .collect();
        rule.replacement = rule
            .replacement
            .chars()
            .take(MAX_FILENAME_CLEANUP_REPLACEMENT_CHARS)
            .collect();
        rule.site = normalize_filename_cleanup_site(&rule.site);
        if rule.scope == FilenameCleanupScope::Global {
            rule.site.clear();
        }
    }

    rules.retain(|rule| !rule.pattern.is_empty());
}

pub fn normalize_filename_cleanup_site(value: &str) -> String {
    let trimmed = normalize_filename_cleanup_header_value(value);
    if trimmed.is_empty() {
        return String::new();
    }

    let candidate = url::Url::parse(&trimmed)
        .ok()
        .and_then(|url| url.host_str().map(str::to_string))
        .unwrap_or_else(|| {
            trimmed.as_str()
                .split(['/', '?', '#'])
                .next()
                .unwrap_or(trimmed.as_str())
                .split(':')
                .next()
                .unwrap_or(trimmed.as_str())
                .to_string()
        });

    let normalized = candidate
        .trim()
        .trim_matches('.')
        .trim_start_matches("*.")
        .to_ascii_lowercase();
    normalized
        .strip_prefix("www.")
        .unwrap_or(&normalized)
        .to_string()
}

fn normalize_filename_cleanup_header_value(value: &str) -> String {
    value
        .trim()
        .replace("\\:", ":")
        .trim_end_matches('\\')
        .trim()
        .to_string()
}

fn filename_cleanup_contains_pattern_variants(pattern: &str) -> Vec<String> {
    let mut variants = vec![pattern.to_string()];
    if pattern.contains(" | ") {
        let variant = pattern.replace(" | ", " _ ");
        if !variants.contains(&variant) {
            variants.push(variant);
        }
    }
    if pattern.contains(" _ ") {
        let variant = pattern.replace(" _ ", " | ");
        if !variants.contains(&variant) {
            variants.push(variant);
        }
    }
    variants
}

pub fn remove_title_query_parameter(url: &str) -> String {
    let Ok(mut parsed) = url::Url::parse(url.trim()) else {
        return url.to_string();
    };
    let query_pairs = parsed
        .query_pairs()
        .map(|(key, value)| (key.into_owned(), value.into_owned()))
        .collect::<Vec<_>>();
    let filtered = query_pairs
        .iter()
        .filter(|(key, _)| !key.eq_ignore_ascii_case("title"))
        .cloned()
        .collect::<Vec<_>>();
    if filtered.len() == query_pairs.len() {
        return url.to_string();
    }

    if filtered.is_empty() {
        parsed.set_query(None);
    } else {
        let mut serializer = url::form_urlencoded::Serializer::new(String::new());
        for (key, value) in filtered {
            serializer.append_pair(&key, &value);
        }
        parsed.set_query(Some(&serializer.finish()));
    }
    parsed.to_string()
}

fn filename_cleanup_source_host(source_url: &str) -> Option<String> {
    let trimmed = source_url.trim();
    if trimmed.is_empty() {
        return None;
    }

    if trimmed.starts_with('{') {
        let value = serde_json::from_str::<serde_json::Value>(trimmed).ok()?;
        for key in ["base_url", "url"] {
            if let Some(url) = value.get(key).and_then(|value| value.as_str()) {
                if let Some(host) = filename_cleanup_source_host(url) {
                    return Some(host);
                }
            }
        }
        return None;
    }

    url::Url::parse(trimmed)
        .ok()
        .and_then(|url| url.host_str().map(normalize_filename_cleanup_site))
        .or_else(|| {
            let site = normalize_filename_cleanup_site(trimmed);
            (!site.is_empty()).then_some(site)
        })
}

fn filename_cleanup_host_matches(host: &str, site: &str) -> bool {
    host == site
}

fn contains_matching_text(text: &str, pattern: &str, case_sensitive: bool) -> bool {
    find_matching_text(text, pattern, case_sensitive).is_some()
}

fn replace_all_matching_text(
    text: &str,
    pattern: &str,
    replacement: &str,
    case_sensitive: bool,
) -> String {
    let mut result = String::with_capacity(text.len());
    let mut remaining = text;

    while let Some((start, end)) = find_matching_text(remaining, pattern, case_sensitive) {
        result.push_str(&remaining[..start]);
        result.push_str(replacement);
        remaining = &remaining[end..];
    }

    result.push_str(remaining);
    result
}

fn strip_matching_suffix<'a>(
    text: &'a str,
    pattern: &str,
    case_sensitive: bool,
) -> Option<&'a str> {
    let pattern_len = pattern.chars().count();
    if pattern_len == 0 {
        return None;
    }

    let positions: Vec<usize> = text
        .char_indices()
        .map(|(index, _)| index)
        .chain(std::iter::once(text.len()))
        .collect();
    if positions.len() <= pattern_len {
        return None;
    }

    let start = positions[positions.len() - 1 - pattern_len];
    if !text_matches(&text[start..], pattern, case_sensitive) {
        return None;
    }

    Some(&text[..start])
}

fn find_matching_text(text: &str, pattern: &str, case_sensitive: bool) -> Option<(usize, usize)> {
    let pattern_len = pattern.chars().count();
    if pattern_len == 0 {
        return None;
    }

    let positions: Vec<usize> = text
        .char_indices()
        .map(|(index, _)| index)
        .chain(std::iter::once(text.len()))
        .collect();
    if positions.len() <= pattern_len {
        return None;
    }

    for start_index in 0..=(positions.len().saturating_sub(pattern_len + 1)) {
        let start = positions[start_index];
        let end = positions[start_index + pattern_len];
        if text_matches(&text[start..end], pattern, case_sensitive) {
            return Some((start, end));
        }
    }

    None
}

fn text_matches(candidate: &str, pattern: &str, case_sensitive: bool) -> bool {
    if case_sensitive {
        candidate == pattern
    } else {
        candidate.to_lowercase() == pattern.to_lowercase()
    }
}

#[derive(Debug, Clone)]
pub struct EncryptionInfo {
    pub method: String,
    pub key_uri: String,
    pub iv: Option<String>,
    pub key_bytes: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct ByteRangeSpec {
    pub length: u64,
    pub offset: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct HlsInitSegmentInfo {
    pub index: usize,
    pub uri: String,
    pub byte_range: Option<ByteRangeSpec>,
}

#[derive(Debug, Clone)]
pub struct SegmentInfo {
    pub index: usize,
    pub uri: String,
    pub duration: f32,
    pub sequence_number: u64,
    pub byte_range: Option<ByteRangeSpec>,
    pub init_segment_index: Option<usize>,
    pub encryption: Option<EncryptionInfo>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DownloadGroup {
    Active,
    History,
}

pub fn download_group_for_status(status: &DownloadStatus) -> DownloadGroup {
    match status {
        DownloadStatus::Pending
        | DownloadStatus::Downloading
        | DownloadStatus::Paused
        | DownloadStatus::Merging
        | DownloadStatus::Converting => DownloadGroup::Active,
        DownloadStatus::Completed | DownloadStatus::Failed(_) | DownloadStatus::Cancelled => {
            DownloadGroup::History
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadTaskSummary {
    pub id: DownloadId,
    pub filename: String,
    #[serde(default)]
    pub file_type: FileType,
    #[serde(default)]
    pub direct_parallel: bool,
    #[serde(default)]
    pub direct_info: Option<DirectDownloadInfo>,
    #[serde(default)]
    pub hls_output_mode: HlsOutputMode,
    #[serde(default)]
    pub hls_media_kind: HlsMediaKind,
    #[serde(default)]
    pub hls_selection: Option<HlsTrackSelection>,
    pub encryption_method: Option<String>,
    pub output_dir: String,
    pub status: DownloadStatus,
    pub total_segments: usize,
    pub completed_segments: usize,
    pub failed_segment_count: usize,
    pub total_bytes: u64,
    pub speed_bytes_per_sec: u64,
    pub created_at: String,
    pub completed_at: Option<String>,
    pub updated_at: String,
    #[serde(default = "default_playback_available")]
    pub playback_available: bool,
    pub file_path: Option<String>,
}

fn default_playback_available() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadTaskSegmentState {
    #[serde(default)]
    pub segment_errors: HashMap<usize, String>,
    pub id: DownloadId,
    pub total_segments: usize,
    pub completed_segment_indices: Vec<usize>,
    pub failed_segment_indices: Vec<usize>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadCounts {
    pub active_count: usize,
    pub history_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadTaskPage {
    pub items: Vec<DownloadTaskSummary>,
    pub total: usize,
    pub page: usize,
    pub page_size: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ResumeDownloadAction {
    Resume,
    ConfirmRestart,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResumeDownloadCheckResult {
    pub action: ResumeDownloadAction,
    pub downloaded_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PlaybackSourceKind {
    Hls,
    File,
    Flv,
    Mpegts,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ChromiumBrowser {
    Chrome,
    Edge,
}

#[derive(Debug, Clone, Serialize)]
pub struct OpenPlaybackSessionResponse {
    pub window_label: String,
    pub playback_url: String,
    pub playback_kind: PlaybackSourceKind,
    #[serde(default)]
    pub is_live: bool,
    pub session_token: String,
    pub filename: String,
    pub status: DownloadStatus,
}

#[derive(Debug, Clone, Serialize)]
pub struct ChromiumExtensionInstallResult {
    pub extension_path: String,
    pub manual_url: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct FirefoxExtensionInstallResult {
    pub extension_path: String,
    pub manual_url: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LiveProtocol {
    Flv,
    Hls,
}

impl Default for LiveProtocol {
    fn default() -> Self {
        LiveProtocol::Flv
    }
}

impl LiveProtocol {
    pub fn default_extension(self) -> &'static str {
        match self {
            LiveProtocol::Flv => "flv",
            LiveProtocol::Hls => "m3u8",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LiveRecordStatus {
    Recording,
    Paused,
    Recorded,
    Failed(String),
    Cancelled,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LiveGroup {
    Active,
    History,
}

pub fn live_group_for_status(status: &LiveRecordStatus) -> LiveGroup {
    match status {
        LiveRecordStatus::Recording | LiveRecordStatus::Paused => LiveGroup::Active,
        LiveRecordStatus::Recorded | LiveRecordStatus::Failed(_) | LiveRecordStatus::Cancelled => {
            LiveGroup::History
        }
    }
}

/// 直播录制分段阈值。两个维度均为可选，任一先达到即切分；均为 None 视为不分段。
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct LiveSplitConfig {
    #[serde(default)]
    pub size_mb: Option<u64>,
    #[serde(default)]
    pub duration_min: Option<u64>,
}

impl LiveSplitConfig {
    /// 归一化阈值下限；两个维度都为空则返回 None（视为不分段）。
    pub fn sanitized(self) -> Option<Self> {
        let size_mb = self.size_mb.map(normalize_live_split_size_mb);
        let duration_min = self.duration_min.map(normalize_live_split_duration_min);
        if size_mb.is_none() && duration_min.is_none() {
            None
        } else {
            Some(Self {
                size_mb,
                duration_min,
            })
        }
    }

    pub fn size_bytes(&self) -> Option<u64> {
        self.size_mb.map(|mb| mb.saturating_mul(1024 * 1024))
    }

    pub fn duration_ms(&self) -> Option<u64> {
        self.duration_min.map(|min| min.saturating_mul(60 * 1000))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveRecordTask {
    pub id: DownloadId,
    pub url: String,
    pub filename: String,
    pub output_dir: String,
    #[serde(default)]
    pub file_path: Option<String>,
    #[serde(default)]
    pub extra_headers: Option<String>,
    #[serde(default)]
    pub protocol: LiveProtocol,
    pub status: LiveRecordStatus,
    #[serde(default)]
    pub total_bytes: u64,
    #[serde(default)]
    pub speed_bytes_per_sec: u64,
    #[serde(default)]
    pub duration_ms: u64,
    pub created_at: DateTime<Utc>,
    #[serde(default)]
    pub completed_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub updated_at: Option<DateTime<Utc>>,
    /// HLS only: working directory containing live segments + index.m3u8 while recording.
    #[serde(default)]
    pub temp_dir: Option<String>,
    /// HLS only: detected at runtime from EXT-X-MAP presence.
    #[serde(default)]
    pub hls_media_kind: Option<HlsMediaKind>,
    /// HLS only: number of segments captured so far.
    #[serde(default)]
    pub segment_count: u64,
    /// 分段录制配置；None 表示不分段（与旧任务兼容）。
    #[serde(default)]
    pub split: Option<LiveSplitConfig>,
    /// 分段产物列表。FLV 为各 part 文件绝对路径；HLS 为各 part 播放列表文件名（相对录制目录）。
    #[serde(default)]
    pub part_paths: Vec<String>,
    /// 分段录制：当前分段开始时的任务累计时长（毫秒），跨断线重连/暂停恢复保持分段时长准确。
    #[serde(default)]
    pub part_started_duration_ms: u64,
    /// 任务独占的录制目录 `{output_dir}/{filename}`：FLV 内含 flv/ 与 mp4/ 子目录，
    /// HLS 内含 m3u8/ 与 mp4/ 子目录。None 表示旧版布局（文件直接位于 output_dir 下）。
    #[serde(default)]
    pub record_dir: Option<String>,
}

impl LiveRecordTask {
    pub fn touch(&mut self) -> DateTime<Utc> {
        let now = Utc::now();
        self.updated_at = Some(now);
        now
    }

    pub fn last_updated_at(&self) -> DateTime<Utc> {
        self.updated_at
            .clone()
            .or_else(|| self.completed_at.clone())
            .unwrap_or(self.created_at)
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateLiveRecordParams {
    pub url: String,
    pub filename: Option<String>,
    pub output_dir: Option<String>,
    pub extra_headers: Option<String>,
    #[serde(default)]
    pub protocol: Option<LiveProtocol>,
    #[serde(default)]
    pub split: Option<LiveSplitConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveRecordSummary {
    pub id: DownloadId,
    pub filename: String,
    #[serde(default)]
    pub protocol: LiveProtocol,
    pub url: String,
    pub output_dir: String,
    pub status: LiveRecordStatus,
    pub total_bytes: u64,
    pub speed_bytes_per_sec: u64,
    pub duration_ms: u64,
    pub created_at: String,
    pub completed_at: Option<String>,
    pub updated_at: String,
    pub file_path: Option<String>,
    #[serde(default)]
    pub temp_dir: Option<String>,
    #[serde(default)]
    pub hls_media_kind: Option<HlsMediaKind>,
    #[serde(default)]
    pub segment_count: u64,
    #[serde(default)]
    pub split: Option<LiveSplitConfig>,
    #[serde(default)]
    pub part_paths: Vec<String>,
    #[serde(default)]
    pub record_dir: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct LiveProgressEvent {
    pub id: DownloadId,
    pub status: LiveRecordStatus,
    pub group: LiveGroup,
    pub total_bytes: u64,
    pub speed_bytes_per_sec: u64,
    pub duration_ms: u64,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveRecordCounts {
    pub active_count: usize,
    pub history_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveRecordPage {
    pub items: Vec<LiveRecordSummary>,
    pub total: usize,
    pub page: usize,
    pub page_size: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_settings_defaults_merge_failed_segment_limit_to_30() {
        let settings = AppSettings::default();
        assert_eq!(
            settings.merge_failed_segment_limit,
            DEFAULT_MERGE_FAILED_SEGMENT_LIMIT
        );
    }

    #[test]
    fn app_settings_clamps_merge_failed_segment_limit() {
        let mut settings = AppSettings {
            merge_failed_segment_limit: MAX_MERGE_FAILED_SEGMENT_LIMIT + 1,
            ..AppSettings::default()
        };
        settings.sanitize();
        assert_eq!(
            settings.merge_failed_segment_limit,
            MAX_MERGE_FAILED_SEGMENT_LIMIT
        );
    }

    #[test]
    fn app_settings_normalizes_merge_failed_segment_limit_boundaries() {
        let cases = [
            (0, 0),
            (30, 30),
            (MAX_MERGE_FAILED_SEGMENT_LIMIT, MAX_MERGE_FAILED_SEGMENT_LIMIT),
            (MAX_MERGE_FAILED_SEGMENT_LIMIT + 1, MAX_MERGE_FAILED_SEGMENT_LIMIT),
        ];

        for (input, expected) in cases {
            assert_eq!(
                normalize_merge_failed_segment_limit(input),
                expected,
                "unexpected normalization for {input}"
            );
        }
    }

    #[test]
    fn app_settings_https_certificate_errors_are_not_ignored_by_default_or_legacy_settings() {
        assert!(!AppSettings::default().ignore_https_certificate_errors);
        let legacy: AppSettings = serde_json::from_str(r#"{"user_agent":"legacy-agent"}"#).unwrap();
        assert!(!legacy.ignore_https_certificate_errors);
        assert_eq!(legacy.user_agent, "legacy-agent");
        assert_eq!(
            legacy.merge_failed_segment_limit,
            DEFAULT_MERGE_FAILED_SEGMENT_LIMIT
        );
    }

    #[test]
    fn app_settings_defaults_download_speed_limit_to_unlimited() {
        let settings: AppSettings = serde_json::from_str(
            r#"{
                "default_download_dir": null,
                "proxy": {"enabled": false, "url": "http://127.0.0.1:10808"},
                "download_concurrency": 8,
                "delete_ts_temp_dir_after_download": true,
                "convert_to_mp4": true
            }"#,
        )
        .expect("settings deserialize");

        assert_eq!(
            settings.download_speed_limit_kbps,
            DEFAULT_DOWNLOAD_SPEED_LIMIT_KBPS
        );
        assert!(!settings.download_smart_speed_limit_enabled);
        assert_eq!(
            settings.download_smart_speed_limit_threshold,
            DEFAULT_DOWNLOAD_SMART_SPEED_LIMIT_THRESHOLD
        );
        assert!(settings.ffmpeg_enabled);
        assert_eq!(settings.history_page_size, DEFAULT_HISTORY_PAGE_SIZE);
    }

    #[test]
    fn app_settings_keeps_positive_download_speed_limit() {
        let mut settings = AppSettings {
            download_speed_limit_kbps: 1024,
            ..AppSettings::default()
        };

        settings.sanitize();

        assert_eq!(settings.download_speed_limit_kbps, 1024);
    }

    #[test]
    fn app_settings_normalizes_smart_download_speed_limit() {
        let mut settings = AppSettings {
            download_speed_limit_kbps: 2048,
            download_smart_speed_limit_enabled: true,
            download_smart_speed_limit_threshold: 0,
            ..AppSettings::default()
        };

        settings.sanitize();

        assert!(settings.download_smart_speed_limit_enabled);
        assert_eq!(
            settings.download_smart_speed_limit_threshold,
            MIN_DOWNLOAD_SMART_SPEED_LIMIT_THRESHOLD
        );

        settings.download_speed_limit_kbps = 0;
        settings.sanitize();
        assert!(!settings.download_smart_speed_limit_enabled);
    }

    #[test]
    fn app_settings_normalizes_invalid_history_page_size() {
        let mut settings = AppSettings {
            history_page_size: 999,
            ..AppSettings::default()
        };

        settings.sanitize();

        assert_eq!(settings.history_page_size, DEFAULT_HISTORY_PAGE_SIZE);
    }

    #[test]
    fn file_type_direct_download_variants_report_extensions() {
        let cases = [
            (FileType::Mp4, Some("mp4")),
            (FileType::Mkv, Some("mkv")),
            (FileType::Avi, Some("avi")),
            (FileType::Wmv, Some("wmv")),
            (FileType::Flv, Some("flv")),
            (FileType::Webm, Some("webm")),
            (FileType::Mov, Some("mov")),
            (FileType::Rmvb, Some("rmvb")),
        ];

        for (file_type, expected_extension) in cases {
            assert!(file_type.is_direct_download());
            assert_eq!(file_type.default_extension(), expected_extension);
        }

        assert!(!FileType::Hls.is_direct_download());
        assert_eq!(FileType::Hls.default_extension(), None);
    }

    #[test]
    fn file_type_progressive_playback_is_limited_to_mp4_and_webm() {
        assert!(FileType::Mp4.supports_progressive_playback());
        assert!(FileType::Webm.supports_progressive_playback());

        for file_type in [
            FileType::Hls,
            FileType::Mkv,
            FileType::Avi,
            FileType::Wmv,
            FileType::Flv,
            FileType::Mov,
            FileType::Rmvb,
        ] {
            assert!(!file_type.supports_progressive_playback());
        }
    }

    #[test]
    fn filename_cleanup_rules_support_contains_suffix_and_ordering() {
        let rules = vec![
            FilenameCleanupRule {
                id: "contains".to_string(),
                pattern: "SITE".to_string(),
                replacement: "".to_string(),
                ..FilenameCleanupRule::default()
            },
            FilenameCleanupRule {
                id: "suffix".to_string(),
                match_type: FilenameCleanupMatchType::Suffix,
                pattern: "_FINAL".to_string(),
                replacement: "".to_string(),
                ..FilenameCleanupRule::default()
            },
        ];

        assert_eq!(
            apply_filename_cleanup_rules("video SITE name_FINAL", &rules, None),
            "video  name"
        );
    }

    #[test]
    fn filename_cleanup_rules_respect_case_sensitivity_and_disabled_rules() {
        let rules = vec![
            FilenameCleanupRule {
                id: "disabled".to_string(),
                enabled: false,
                pattern: "keep".to_string(),
                replacement: "changed".to_string(),
                ..FilenameCleanupRule::default()
            },
            FilenameCleanupRule {
                id: "case-sensitive".to_string(),
                case_sensitive: true,
                pattern: "TV".to_string(),
                replacement: "X".to_string(),
                ..FilenameCleanupRule::default()
            },
        ];

        assert_eq!(
            apply_filename_cleanup_rules("TV keep tv", &rules, None),
            "X keep tv"
        );
    }

    #[test]
    fn filename_cleanup_rules_support_regex_capture_groups() {
        let rules = vec![FilenameCleanupRule {
            id: "regex".to_string(),
            match_type: FilenameCleanupMatchType::Regex,
            pattern: r"^(.+?) - (Sample\.TV).+$".to_string(),
            replacement: "$1 [$2]".to_string(),
            ..FilenameCleanupRule::default()
        }];

        assert_eq!(
            apply_filename_cleanup_rules(
                "Example video - Sample.TV _ free stream",
                &rules,
                None
            ),
            "Example video [Sample.TV]"
        );
    }

    #[test]
    fn filename_cleanup_site_rules_match_normalized_domain_only() {
        let rules = vec![
            FilenameCleanupRule {
                id: "global".to_string(),
                pattern: "GLOBAL".to_string(),
                replacement: "".to_string(),
                ..FilenameCleanupRule::default()
            },
            FilenameCleanupRule {
                id: "site".to_string(),
                scope: FilenameCleanupScope::Site,
                site: "https://Sample.tv/path".to_string(),
                pattern: "SITE".to_string(),
                replacement: "".to_string(),
                ..FilenameCleanupRule::default()
            },
        ];

        assert_eq!(
            apply_filename_cleanup_rules(
                "GLOBAL video SITE",
                &rules,
                Some("https://www.sample.tv/watch/1")
            ),
            " video "
        );
        assert_eq!(
            apply_filename_cleanup_rules(
                "GLOBAL video SITE",
                &rules,
                Some("sample.tv")
            ),
            " video "
        );
        assert_eq!(
            apply_filename_cleanup_rules(
                "GLOBAL video SITE",
                &rules,
                Some("https://media.sample.tv/watch/1")
            ),
            " video SITE"
        );
        assert_eq!(
            apply_filename_cleanup_rules(
                "GLOBAL video SITE",
                &rules,
                Some("https://example.com/video")
            ),
            " video SITE"
        );
    }

    #[test]
    fn filename_cleanup_reports_match_even_when_replacement_keeps_text() {
        let rules = vec![FilenameCleanupRule {
            id: "same".to_string(),
            pattern: "SITE".to_string(),
            replacement: "SITE".to_string(),
            ..FilenameCleanupRule::default()
        }];

        let result = apply_filename_cleanup_rules_with_match("video SITE", &rules, None);

        assert!(result.matched);
        assert_eq!(result.filename, "video SITE");
    }

    #[test]
    fn remove_title_query_parameter_preserves_other_query_values() {
        assert_eq!(
            remove_title_query_parameter(
                "https://example.com/watch?title=Sample&id=42#part"
            ),
            "https://example.com/watch?id=42#part"
        );
        assert_eq!(
            remove_title_query_parameter("https://example.com/watch?TITLE=Sample"),
            "https://example.com/watch"
        );
        assert_eq!(
            remove_title_query_parameter("https://example.com/watch?id=42"),
            "https://example.com/watch?id=42"
        );
    }

    #[test]
    fn legacy_filename_cleanup_rules_default_to_global() {
        let rule: FilenameCleanupRule = serde_json::from_str(
            r#"{"id":"legacy","enabled":true,"match_type":"contains","pattern":"Site","replacement":"","case_sensitive":false}"#,
        )
        .unwrap();

        assert_eq!(rule.scope, FilenameCleanupScope::Global);
        assert!(rule.site.is_empty());
    }

    #[test]
    fn filename_cleanup_rule_sanitization_removes_empty_patterns_and_fixes_ids() {
        let mut settings = AppSettings {
            filename_cleanup_rules: vec![
                FilenameCleanupRule {
                    id: " ".to_string(),
                    pattern: " Site ".to_string(),
                    ..FilenameCleanupRule::default()
                },
                FilenameCleanupRule {
                    id: "empty".to_string(),
                    pattern: "   ".to_string(),
                    ..FilenameCleanupRule::default()
                },
            ],
            ..AppSettings::default()
        };

        settings.sanitize();

        assert_eq!(settings.filename_cleanup_rules.len(), 1);
        assert_eq!(settings.filename_cleanup_rules[0].id, "cleanup-1");
        assert_eq!(settings.filename_cleanup_rules[0].pattern, "Site");
    }
}
