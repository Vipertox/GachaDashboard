package de.vipertox.gachadashboard

// Eigene Activity für das HoYoLAB-Login-Fenster. Unter Android braucht jedes weitere
// Tauri-Fenster eine Activity, die der Rust-Teil per `activity_name` anfordert.
class HoyolabLoginActivity : TauriActivity()
