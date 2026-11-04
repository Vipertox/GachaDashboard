//! Webview-Login bei HoYoLAB: öffnet die Anmeldeseite, liest nach dem Login
//! `ltuid_v2` und `ltoken_v2` aus den Cookies und schließt das Fenster wieder.
//!
//! Hinweis: `cookies_for_url` wird erst aufgerufen, nachdem eine hoyolab.com-Seite
//! fertig geladen wurde und danach mindestens eine Abfragerunde vergangen ist.
//! Für URLs ohne Cookies stürzt wry 0.57 unter Android sonst ab (wry #1837).
//!
//! Unter Android braucht das Fenster eine eigene Activity (`HoyolabLoginActivity`
//! in `gen/android`). Ohne sie bricht wry beim Anlegen der Webview ab.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;
use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

const LABEL: &str = "hoyolab-login";
const LOGIN_URL: &str = "https://www.hoyolab.com/home";
const TIMEOUT_SECS: u64 = 600;
/// So lange wartet ein neuer Login, bis das Fenster des vorigen geschlossen ist.
const CLOSE_WAIT_MS: u64 = 2000;

/// Es läuft höchstens ein Login; das Fenster-Label ist fest.
static RUNNING: AtomicBool = AtomicBool::new(false);

#[derive(Serialize)]
pub struct Tokens {
    pub ltuid: String,
    pub ltoken: String,
}

/// Nur hoyolab.com selbst und echte Subdomains, nicht etwa "evilhoyolab.com".
fn is_hoyolab_host(host: &str) -> bool {
    host == "hoyolab.com" || host.ends_with(".hoyolab.com")
}

/// Gibt auf jedem Rückweg (auch per `?`) die Sperre frei und schließt das Login-Fenster.
struct LoginGuard {
    window: Option<WebviewWindow>,
}

impl Drop for LoginGuard {
    fn drop(&mut self) {
        if let Some(window) = self.window.take() {
            let _ = window.close();
        }
        RUNNING.store(false, Ordering::SeqCst);
    }
}

#[tauri::command]
pub async fn hoyolab_webview_login(app: AppHandle) -> Result<Tokens, String> {
    if RUNNING
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        // Zweiter Aufruf: kein zweites Fenster mit demselben Label, sondern das offene nach vorn holen.
        if let Some(existing) = app.get_webview_window(LABEL) {
            let _ = existing.set_focus();
        }
        return Err("Eine Anmeldung läuft bereits".to_string());
    }
    let mut guard = LoginGuard { window: None };

    // close() ist asynchron: das Fenster eines gerade beendeten Logins kann noch existieren.
    for _ in 0..CLOSE_WAIT_MS / 100 {
        if app.get_webview_window(LABEL).is_none() {
            break;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    let loaded = Arc::new(AtomicBool::new(false));
    let flag = loaded.clone();
    let builder = WebviewWindowBuilder::new(
        &app,
        LABEL,
        WebviewUrl::External(LOGIN_URL.parse().map_err(|_| "Ungültige URL".to_string())?),
    );
    // Fenstertitel gibt es nur auf dem Desktop; unter Android fehlt die Methode.
    #[cfg(desktop)]
    let builder = builder.title("Bei HoYoLAB anmelden");
    #[cfg(target_os = "android")]
    let builder = builder
        .activity_name("HoyolabLoginActivity")
        .created_by_activity_name("MainActivity");
    let window = builder
        .on_page_load(move |_, payload| {
            if matches!(payload.event(), PageLoadEvent::Finished)
                && payload.url().host_str().is_some_and(is_hoyolab_host)
            {
                flag.store(true, Ordering::SeqCst);
            }
        })
        .build()
        .map_err(|e| e.to_string())?;
    guard.window = Some(window.clone());

    let cookie_url = url::Url::parse("https://www.hoyolab.com").map_err(|e| e.to_string())?;

    // Erst in der Runde nach dem ersten Laden auslesen, damit die Seite ihre Cookies gesetzt hat
    let mut seen_loaded = false;
    for _ in 0..TIMEOUT_SECS {
        tokio::time::sleep(Duration::from_secs(1)).await;

        if app.get_webview_window(LABEL).is_none() {
            return Err("Anmeldefenster wurde geschlossen".to_string());
        }
        if !loaded.load(Ordering::SeqCst) {
            continue;
        }
        if !seen_loaded {
            seen_loaded = true;
            continue;
        }

        let cookies = window
            .cookies_for_url(cookie_url.clone())
            .map_err(|e| e.to_string())?;
        let find = |name: &str| {
            cookies
                .iter()
                .find(|c| c.name() == name)
                .map(|c| c.value().to_string())
        };

        if let (Some(ltuid), Some(ltoken)) = (find("ltuid_v2"), find("ltoken_v2")) {
            // Cookies entfernen, damit der nächste Profil-Login nicht im alten Konto landet.
            for c in cookies {
                let _ = window.delete_cookie(c);
            }
            // Fenster schließt der Guard
            return Ok(Tokens { ltuid, ltoken });
        }
    }

    Err("Zeitüberschreitung bei der Anmeldung".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn erkennt_nur_hoyolab_und_subdomains() {
        assert!(is_hoyolab_host("hoyolab.com"));
        assert!(is_hoyolab_host("www.hoyolab.com"));
        assert!(is_hoyolab_host("account.hoyolab.com"));
        assert!(!is_hoyolab_host("evilhoyolab.com"));
        assert!(!is_hoyolab_host("hoyolab.com.evil.com"));
        assert!(!is_hoyolab_host(""));
    }
}
