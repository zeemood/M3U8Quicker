use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;

use crate::error::AppError;
use crate::models::{download_group_for_status, DownloadGroup, DownloadId, DownloadTask};
use crate::state::AppState;

const SHUTDOWN_POLL_INTERVAL: Duration = Duration::from_secs(2);
const SHUTDOWN_IDLE_POLLS_REQUIRED: usize = 3;
const SHUTDOWN_COUNTDOWN_SECONDS: u32 = 30;

#[derive(Default)]
pub struct DownloadShutdownController {
    armed: AtomicBool,
    saw_active_download: AtomicBool,
    watcher_running: AtomicBool,
    pending: AtomicBool,
    cancel_token: Mutex<Option<CancellationToken>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadShutdownStatus {
    pub armed: bool,
    pub pending: bool,
    pub active_downloads: usize,
    pub countdown_seconds: u32,
}

pub(crate) fn note_download_started(state: &AppState) {
    let controller = &state.download_shutdown;
    if controller.armed.load(Ordering::SeqCst) {
        controller.saw_active_download.store(true, Ordering::SeqCst);
    }
}

#[derive(Clone, Serialize)]
struct DownloadShutdownCountdownEvent {
    seconds: u32,
}

#[tauri::command]
pub async fn get_download_shutdown_status(
    state: State<'_, AppState>,
) -> Result<DownloadShutdownStatus, AppError> {
    shutdown_status(state.inner()).await
}

#[tauri::command]
pub async fn set_download_shutdown_armed(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    enabled: bool,
) -> Result<DownloadShutdownStatus, AppError> {
    let controller = state.download_shutdown.clone();

    if enabled {
        if controller.pending.load(Ordering::SeqCst) {
            return Err(AppError::InvalidInput(
                crate::i18n::tr("downloadShutdownCountdownActive").to_string(),
            ));
        }

        let had_active_downloads = count_active_downloads(&state.downloads).await > 0;
        if !controller.armed.swap(true, Ordering::SeqCst) {
            controller
                .saw_active_download
                .store(had_active_downloads, Ordering::SeqCst);
        }

        if controller
            .watcher_running
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_ok()
        {
            let downloads = state.downloads.clone();
            tauri::async_runtime::spawn(run_shutdown_watcher(app_handle, downloads, controller));
        }
    } else {
        controller.armed.store(false, Ordering::SeqCst);
        controller
            .saw_active_download
            .store(false, Ordering::SeqCst);
        controller.pending.store(false, Ordering::SeqCst);
        if let Some(token) = controller.cancel_token.lock().await.take() {
            token.cancel();
        }
    }

    shutdown_status(state.inner()).await
}

async fn shutdown_status(state: &AppState) -> Result<DownloadShutdownStatus, AppError> {
    let active_downloads = count_active_downloads(&state.downloads).await;
    Ok(DownloadShutdownStatus {
        armed: state.download_shutdown.armed.load(Ordering::SeqCst),
        pending: state.download_shutdown.pending.load(Ordering::SeqCst),
        active_downloads,
        countdown_seconds: SHUTDOWN_COUNTDOWN_SECONDS,
    })
}

async fn run_shutdown_watcher(
    app_handle: AppHandle,
    downloads: Arc<Mutex<std::collections::HashMap<DownloadId, DownloadTask>>>,
    controller: Arc<DownloadShutdownController>,
) {
    let mut idle_polls = 0usize;

    loop {
        tokio::time::sleep(SHUTDOWN_POLL_INTERVAL).await;

        if controller.pending.load(Ordering::SeqCst) {
            break;
        }
        if !controller.armed.load(Ordering::SeqCst) {
            idle_polls = 0;
            continue;
        }

        let active_downloads = count_active_downloads(&downloads).await;
        if active_downloads > 0 {
            controller.saw_active_download.store(true, Ordering::SeqCst);
            idle_polls = 0;
            continue;
        }

        if !controller.saw_active_download.load(Ordering::SeqCst) {
            idle_polls = 0;
            continue;
        }

        idle_polls += 1;
        if idle_polls < SHUTDOWN_IDLE_POLLS_REQUIRED {
            continue;
        }

        if !controller.armed.swap(false, Ordering::SeqCst) {
            continue;
        }

        controller
            .saw_active_download
            .store(false, Ordering::SeqCst);
        controller.pending.store(true, Ordering::SeqCst);

        let cancel_token = CancellationToken::new();
        *controller.cancel_token.lock().await = Some(cancel_token.clone());
        let _ = app_handle.emit(
            "download-shutdown-countdown",
            DownloadShutdownCountdownEvent {
                seconds: SHUTDOWN_COUNTDOWN_SECONDS,
            },
        );

        let countdown_controller = controller.clone();
        tauri::async_runtime::spawn(async move {
            tokio::select! {
                _ = tokio::time::sleep(Duration::from_secs(
                    SHUTDOWN_COUNTDOWN_SECONDS as u64,
                )) => {
                    if !countdown_controller.pending.load(Ordering::SeqCst) {
                        return;
                    }

                    match request_system_shutdown().await {
                        Ok(()) => {
                            let _ = app_handle.emit("download-shutdown-requested", ());
                        }
                        Err(error) => {
                            let _ = app_handle.emit(
                                "download-shutdown-failed",
                                error.to_string(),
                            );
                        }
                    }

                    countdown_controller.pending.store(false, Ordering::SeqCst);
                    *countdown_controller.cancel_token.lock().await = None;
                }
                _ = cancel_token.cancelled() => {
                    countdown_controller.pending.store(false, Ordering::SeqCst);
                }
            }
        });
        break;
    }

    controller.watcher_running.store(false, Ordering::SeqCst);
}

async fn count_active_downloads(
    downloads: &Arc<Mutex<std::collections::HashMap<DownloadId, DownloadTask>>>,
) -> usize {
    downloads
        .lock()
        .await
        .values()
        .filter(|task| download_group_for_status(&task.status) == DownloadGroup::Active)
        .count()
}

#[cfg(target_os = "windows")]
async fn request_system_shutdown() -> Result<(), AppError> {
    let shutdown_error = match run_windows_hidden_command(
        "shutdown.exe",
        &["/s", "/f", "/t", "0"],
    )
    .await
    {
        Ok(()) => return Ok(()),
        Err(error) => error,
    };

    match run_windows_hidden_command(
        "powershell.exe",
        &[
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Stop-Computer -Force",
        ],
    )
    .await
    {
        Ok(()) => Ok(()),
        Err(fallback_error) => Err(AppError::Internal(format!(
            "{}: shutdown.exe: {}; powershell.exe: {}",
            crate::i18n::tr("systemShutdownCommandFailed"),
            shutdown_error,
            fallback_error
        ))),
    }
}

#[cfg(target_os = "windows")]
async fn run_windows_hidden_command(
    program: &str,
    args: &[&str],
) -> Result<(), String> {
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    let output = tokio::process::Command::new(program)
        .args(args)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .await
        .map_err(|error| error.to_string())?;
    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let detail = if !stderr.is_empty() {
        stderr
    } else if !stdout.is_empty() {
        stdout
    } else {
        "no command output".to_string()
    };
    Err(format!(
        "exit code {:?}: {detail}",
        output.status.code()
    ))
}

#[cfg(target_os = "macos")]
async fn request_system_shutdown() -> Result<(), AppError> {
    let status = tokio::process::Command::new("osascript")
        .args(["-e", "tell application \"System Events\" to shut down"])
        .status()
        .await?;
    if status.success() {
        Ok(())
    } else {
        Err(AppError::Internal(
            crate::i18n::tr("systemShutdownCommandFailed").to_string(),
        ))
    }
}

#[cfg(target_os = "linux")]
async fn request_system_shutdown() -> Result<(), AppError> {
    let systemctl_status = tokio::process::Command::new("systemctl")
        .arg("poweroff")
        .status()
        .await;
    if matches!(systemctl_status, Ok(status) if status.success()) {
        return Ok(());
    }

    let shutdown_status = tokio::process::Command::new("shutdown")
        .args(["-h", "now"])
        .status()
        .await?;
    if shutdown_status.success() {
        Ok(())
    } else {
        Err(AppError::Internal(
            crate::i18n::tr("systemShutdownCommandFailed").to_string(),
        ))
    }
}

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
async fn request_system_shutdown() -> Result<(), AppError> {
    Err(AppError::Internal(
        crate::i18n::tr("systemShutdownUnsupported").to_string(),
    ))
}
