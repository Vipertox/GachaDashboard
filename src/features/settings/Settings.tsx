import { useApp } from "../../app/state";
import { fieldCls, fieldStyle } from "../../components/ui";
import type { AppSettings } from "../../model/types";

export function Settings() {
  const { settings, updateSettings } = useApp();
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Einstellungen</h1>
      <label className="block space-y-1">
        <span className="text-sm" style={{ color: "var(--muted)" }}>Aktualisierungsintervall im Vordergrund</span>
        <select
          className={fieldCls}
          style={fieldStyle}
          value={settings.refreshMinutes}
          onChange={(e) => updateSettings({ refreshMinutes: Number(e.target.value) })}
        >
          {[5, 10, 15, 30].map((m) => (
            <option key={m} value={m}>
              alle {m} Minuten
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-sm" style={{ color: "var(--muted)" }}>Design</span>
        <select
          className={fieldCls}
          style={fieldStyle}
          value={settings.theme}
          onChange={(e) => updateSettings({ theme: e.target.value as AppSettings["theme"] })}
        >
          <option value="system">Wie System</option>
          <option value="dark">Dunkel</option>
          <option value="light">Hell</option>
        </select>
      </label>
    </div>
  );
}
