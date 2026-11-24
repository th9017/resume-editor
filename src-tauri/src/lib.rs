use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::thread::sleep;
use std::time::{Duration, Instant};

use tauri_plugin_fs::FsExt;

const PDF_TIMEOUT: Duration = Duration::from_secs(30);

#[tauri::command]
fn exe_dir() -> Option<String> {
    std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(|dir| dir.to_string_lossy().into_owned()))
}

/// Windows 自带的无头打印宿主：Edge 优先，其次 Chrome。
fn browser_executable() -> Option<PathBuf> {
    let mut roots: Vec<String> = Vec::new();
    for key in ["ProgramFiles(x86)", "ProgramFiles", "LOCALAPPDATA"] {
        if let Some(value) = std::env::var_os(key) {
            roots.push(value.to_string_lossy().into_owned());
        }
    }
    for root in &roots {
        for candidate in [
            "Microsoft/Edge/Application/msedge.exe",
            "Google/Chrome/Application/chrome.exe",
        ] {
            let path = Path::new(root).join(candidate);
            if path.is_file() {
                return Some(path);
            }
        }
    }
    None
}

fn percent_encode(path: &str) -> String {
    let mut out = String::with_capacity(path.len());
    for byte in path.as_bytes() {
        let ch = *byte as char;
        if ch.is_ascii_alphanumeric() || "-._~:/?#[]@!$&'()*+,;=".contains(ch) {
            out.push(ch);
        } else {
            out.push_str(&format!("%{byte:02X}"));
        }
    }
    out
}

fn file_url(path: &Path) -> String {
    let text = path.to_string_lossy().replace('\\', "/");
    let encoded = percent_encode(&text);
    let bytes = encoded.as_bytes();
    let drive_letter = bytes.first().is_some_and(|b| b.is_ascii_alphabetic());
    if drive_letter && encoded.get(1..3) == Some(":/") {
        return format!("file:///{encoded}");
    }
    format!("file://{encoded}")
}

fn headless_pdf_args(profile: &Path, html: &Path, pdf: &Path) -> Vec<String> {
    vec![
        "--headless".into(),
        "--disable-gpu".into(),
        "--no-first-run".into(),
        "--no-default-browser-check".into(),
        format!("--user-data-dir={}", profile.to_string_lossy()),
        "--no-pdf-header-footer".into(),
        format!("--print-to-pdf={}", pdf.to_string_lossy()),
        file_url(html),
    ]
}

fn wait_for(child: &mut Child, deadline: Duration) -> Result<bool, String> {
    let started = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) => return Ok(status.success()),
            Ok(None) => {
                if started.elapsed() > deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err("浏览器导出超时".into());
                }
                sleep(Duration::from_millis(80));
            }
            Err(error) => {
                let _ = child.kill();
                return Err(format!("无法启动浏览器：{error}"));
            }
        }
    }
}

/// 直接生成 PDF；失败时由前端回退到系统打印对话框。
#[tauri::command]
fn print_html_to_pdf(html: String, pdf_path: String) -> Result<String, String> {
    let browser = browser_executable().ok_or("未找到 Edge 或 Chrome，请改用系统打印")?;
    let pdf = Path::new(pdf_path.as_str());
    let parent = pdf.parent().ok_or("PDF 保存路径无效")?;
    std::fs::create_dir_all(parent).map_err(|error| format!("无法创建输出目录：{error}"))?;
    if pdf.exists() {
        std::fs::remove_file(pdf).map_err(|error| format!("无法覆盖已有文件：{error}"))?;
    }

    let scratch = std::env::temp_dir().join("resume-editor-pdf");
    std::fs::create_dir_all(&scratch).map_err(|error| format!("无法创建临时目录：{error}"))?;
    let html_path = scratch.join(format!("resume-{}.html", std::process::id()));
    std::fs::write(&html_path, html).map_err(|error| format!("无法写入临时 HTML：{error}"))?;

    let args = headless_pdf_args(&scratch, &html_path, pdf);
    let spawned = Command::new(browser)
        .args(&args)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn();
    let mut child = match spawned {
        Ok(child) => child,
        Err(error) => {
            let _ = std::fs::remove_file(&html_path);
            return Err(format!("无法启动浏览器：{error}"));
        }
    };

    let succeeded = wait_for(&mut child, PDF_TIMEOUT);
    let _ = std::fs::remove_file(&html_path);
    if !succeeded? {
        return Err("浏览器导出未正常结束".into());
    }
    let metadata = std::fs::metadata(pdf).map_err(|_| "未生成 PDF 文件".to_string())?;
    if metadata.len() == 0 {
        return Err("生成的 PDF 为空".into());
    }
    Ok(pdf.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn windows_path_becomes_file_url() {
        let url = file_url(Path::new(r"C:\Users\jiang\AppData\Local\Temp\a b.html"));
        assert_eq!(url, "file:///C:/Users/jiang/AppData/Local/Temp/a%20b.html");
    }

    #[test]
    fn non_ascii_path_is_percent_encoded() {
        let url = file_url(Path::new(r"C:\用户\简历.html"));
        assert!(url.starts_with("file:///C:/%E7%94%A8%E6%88%B7/"), "{url}");
        assert!(!url.contains(' '), "{url}");
        assert!(!url.contains('\\'), "{url}");
    }

    #[test]
    fn unix_path_keeps_single_authority_slash() {
        assert_eq!(file_url(Path::new("/tmp/a b.html")), "file:///tmp/a%20b.html");
    }

    #[test]
    fn pdf_arguments_target_the_requested_files() {
        let args = headless_pdf_args(
            Path::new("/tmp/profile"),
            Path::new("/tmp/out.html"),
            Path::new("/tmp/final.pdf"),
        );
        assert!(args.contains(&"--headless".to_string()));
        assert!(args.contains(&"--no-pdf-header-footer".to_string()));
        assert!(args.iter().any(|a| a.starts_with("--user-data-dir=")));
        assert!(args
            .iter()
            .any(|a| a.ends_with("final.pdf") && a.starts_with("--print-to-pdf=")));
        assert_eq!(args.last().unwrap(), "file:///tmp/out.html");
    }

    #[test]
    fn headless_browser_renders_a_real_pdf() {
        if browser_executable().is_none() {
            return;
        }
        let dir = std::env::temp_dir().join(format!("resume-editor-test-{}", std::process::id()));
        let target = dir.join("导出 结果.pdf");
        let html = "<!doctype html><html><head><meta charset=\"utf-8\">\
                    <style>@page{size:A4;margin:14mm 16mm}</style></head>\
                    <body><h1>静默导出</h1></body></html>";

        let outcome = print_html_to_pdf(html.to_string(), target.to_string_lossy().into_owned());

        let written = std::fs::read(&target);
        let _ = std::fs::remove_dir_all(&dir);
        let path = outcome.unwrap_or_else(|error| panic!("导出失败：{error}"));
        assert!(path.ends_with("导出 结果.pdf"), "{path}");
        assert!(written.unwrap().starts_with(b"%PDF-"), "不是有效的 PDF");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if let Some(dir) = std::env::current_exe()?.parent() {
                let _ = app.fs_scope().allow_directory(dir, true);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![exe_dir, print_html_to_pdf])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
