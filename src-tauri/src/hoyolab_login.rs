//! Webview-Login bei HoYoLAB: öffnet die Anmeldeseite, liest nach dem Login
//! `ltuid_v2` und `ltoken_v2` aus den Cookies und schließt das Fenster wieder.
//!
//! Hinweis: `cookies_for_url` wird erst aufgerufen, nachdem eine hoyolab.com-Seite
//! fertig geladen wurde. Für URLs ohne Cookies stürzt wry 0.57 sonst ab (wry #1837).

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;
use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

const LABEL: &str = "hoyolab-login";
const LOGIN_URL: &str = "https://www.hoyolab.com/home";
const TIMEOUT_SECS: u64 = 600;

#[derive(Serialize)]
pub struct Tokens {
    pub ltuid: String,
    pub ltoken: String,
}

#[tauri::command]
pub async fn hoyolab_webview_login(app: AppHandle) -> Result<Tokens, String> {
    if let Some(existing) = app.get_webview_window(LABEL) {
        let _ = existing.close();
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
    let window = builder
        .on_page_load(move |_, payload| {
            if matches!(payload.event(), PageLoadEvent::Finished)
                && payload
                    .url()
                    .host_str()
                    .is_some_and(|h| h.ends_with("hoyolab.com"))
            {
                flag.store(true, Ordering::SeqCst);
            }
        })
        .build()
        .map_err(|e| e.to_string())?;

    let cookie_url = url::Url::parse("https://www.hoyolab.com").map_err(|e| e.to_string())?;

    for _ in 0..TIMEOUT_SECS {
        tokio::time::sleep(Duration::from_secs(1)).await;

        if app.get_webview_window(LABEL).is_none() {
            return Err("Anmeldefenster wurde geschlossen".to_string());
        }
        if !loaded.load(Ordering::SeqCst) {
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
            let _ = window.close();
            return Ok(Tokens { ltuid, ltoken });
        }
    }

    let _ = window.close();
    Err("Zeitüberschreitung bei der Anmeldung".to_string())
}
