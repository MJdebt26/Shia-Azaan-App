"use client";

import { METHODS } from "@/lib/prayer";
import type { MethodKey } from "@/lib/types";

interface SettingsCardProps {
  method: MethodKey;
  onMethod: (m: MethodKey) => void;
  fmt24: boolean;
  onFmt: (v: boolean) => void;
  alertsOn: boolean;
  onToggleAlerts: () => void;
  adhanUrl: string;
  onAdhanUrl: (v: string) => void;
  canInstall: boolean;
  isIOS: boolean;
  installed: boolean;
  onInstall: () => void;
}

export function SettingsCard({
  method,
  onMethod,
  fmt24,
  onFmt,
  alertsOn,
  onToggleAlerts,
  adhanUrl,
  onAdhanUrl,
  canInstall,
  isIOS,
  installed,
  onInstall,
}: SettingsCardProps) {
  return (
    <div className="card">
      <div className="secthead">
        <span className="t">Settings</span>
        <span className="line" />
      </div>
      <div className="setwrap">
        <div className="setrow">
          <div className="lbl">
            Calculation method
            <div className="d">{METHODS[method].label}</div>
          </div>
          <div className="seg">
            <button className={method === "leva" ? "on" : ""} onClick={() => onMethod("leva")}>
              Qom
            </button>
            <button className={method === "tehran" ? "on" : ""} onClick={() => onMethod("tehran")}>
              Tehran
            </button>
          </div>
        </div>

        <div className="setrow">
          <div className="lbl">Time format</div>
          <div className="seg">
            <button className={!fmt24 ? "on" : ""} onClick={() => onFmt(false)}>
              12h
            </button>
            <button className={fmt24 ? "on" : ""} onClick={() => onFmt(true)}>
              24h
            </button>
          </div>
        </div>

        <div className="setrow">
          <div className="lbl">
            Prayer alert
            <div className="d">Sound + banner when a time arrives</div>
          </div>
          <button
            className={`toggle ${alertsOn ? "on" : ""}`}
            onClick={onToggleAlerts}
            role="switch"
            aria-checked={alertsOn}
            aria-label="Prayer alert"
          />
        </div>

        {alertsOn && (
          <div className="custom-adhan show">
            <label htmlFor="adhanUrl">Adhan audio URL (optional · paste your reciter&apos;s .mp3)</label>
            <input
              id="adhanUrl"
              type="url"
              placeholder="https://…/adhan.mp3"
              autoComplete="off"
              value={adhanUrl}
              onChange={(e) => onAdhanUrl(e.target.value)}
            />
          </div>
        )}

        {!installed && (canInstall || isIOS) && (
          <div className="setrow">
            <div className="lbl">
              Install app
              <div className="d">
                {canInstall ? "Add to your home screen" : "Share → Add to Home Screen"}
              </div>
            </div>
            {canInstall ? (
              <button className="calib" onClick={onInstall} style={{ marginTop: 0 }}>
                Install
              </button>
            ) : (
              <span className="ios-share" aria-hidden="true">
                Share ↑
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
