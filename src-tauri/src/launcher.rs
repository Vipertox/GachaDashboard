//! Liest den Kuro-`oauthCode` aus dem Cache des Wuthering-Waves-Launchers (nur Windows).
//!
//! Gelesen wird ausschließlich `%APPDATA%\KR_G153\A1730\KRSDKUserLauncherCache.json`.
//! Die Datei bleibt unverändert, der Code wird nie geloggt.

use serde_json::Value;

const XOR_KEY: u8 = 5;
const CODE_LEN: usize = 36;

/// Jedes Zeichen ist mit dem Schlüssel 5 per XOR verschleiert.
pub fn decode(obfuscated: &str) -> String {
    obfuscated
        .bytes()
        .map(|b| (b ^ XOR_KEY) as char)
        .collect()
}

/// Nimmt den ersten Eintrag, dessen entschlüsselter Code 36 Zeichen lang ist.
pub fn extract_code(json: &str) -> Result<String, String> {
    let value: Value =
        serde_json::from_str(json).map_err(|_| "Launcher-Cache ist kein gültiges JSON".to_string())?;
    let entries = match &value {
        Value::Array(a) => a.clone(),
        other => vec![other.clone()],
    };
    entries
        .iter()
        .filter_map(|e| e.get("oauthCode").and_then(Value::as_str))
        .map(decode)
        .find(|c| c.chars().count() == CODE_LEN)
        .ok_or_else(|| "Kein Kuro-Code im Launcher-Cache gefunden. Im Launcher anmelden und erneut versuchen.".to_string())
}

#[cfg(windows)]
pub fn read_code() -> Result<String, String> {
    let appdata = std::env::var("APPDATA").map_err(|_| "APPDATA nicht gesetzt".to_string())?;
    let path = std::path::Path::new(&appdata)
        .join("KR_G153")
        .join("A1730")
        .join("KRSDKUserLauncherCache.json");
    let text = std::fs::read_to_string(&path)
        .map_err(|_| "Launcher-Cache nicht gefunden. Ist der Wuthering-Waves-Launcher installiert und angemeldet?".to_string())?;
    extract_code(&text)
}

#[cfg(not(windows))]
pub fn read_code() -> Result<String, String> {
    Err("Nur unter Windows verfügbar".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn encode(plain: &str) -> String {
        plain.bytes().map(|b| (b ^ XOR_KEY) as char).collect()
    }

    #[test]
    fn xor_ist_umkehrbar() {
        assert_eq!(decode(&encode("abc-123")), "abc-123");
    }

    #[test]
    fn findet_code_mit_36_zeichen() {
        let code = "123e4567-e89b-12d3-a456-426614174000";
        assert_eq!(code.len(), 36);
        let json = format!(r#"[{{"oauthCode":"{}"}}]"#, encode(code));
        assert_eq!(extract_code(&json).unwrap(), code);
    }

    #[test]
    fn meldet_fehlenden_code() {
        assert!(extract_code("[]").is_err());
        assert!(extract_code(r#"[{"oauthCode":"kurz"}]"#).is_err());
    }
}
