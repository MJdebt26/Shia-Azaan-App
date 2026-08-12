"use client";

import { useState } from "react";
import { AdhanPicker, type AdhanPlayerLike } from "./AdhanPicker";
import { Callout, Card, Divider, Row, Segmented, Stepper } from "@/components/ui/Controls";
import {
  IconBell,
  IconChevron,
  IconInfo,
  IconPlay,
  IconWarn,
} from "@/components/ui/Icon";
import { ALERTABLE, PRAYER_BY_KEY } from "@/lib/constants";
import { getAdhanOption } from "@/lib/audio/catalog";
import {
  summarizeCapabilities,
  type NotificationCapabilities,
} from "@/lib/notifications/capabilities";
import type { AlertMode, AlertSettings, AlertableKey } from "@/lib/types";

/**
 * Prayer alerts.
 *
 * The design rule here is that the app never claims an alert will arrive when
 * it cannot. `capabilities` is rendered honestly, including the iOS case where
 * the fix is to install to the Home Screen.
 */

interface AlertsCardProps {
  alerts: AlertSettings;
  onChange: (key: AlertableKey, next: AlertSettings[AlertableKey]) => void;
  capabilities: NotificationCapabilities;
  onRequestPermission: () => void;
  busy: boolean;
  pushEnabled: boolean;
  onTogglePush: (on: boolean) => void;
  customUrl: string;
  onCustomUrl: (url: string) => void;
  player: AdhanPlayerLike;
  onTestNotification: () => void;
}

const MODE_OPTIONS: ReadonlyArray<{ value: AlertMode; label: string }> = [
  { value: "off", label: "Off" },
  { value: "notify", label: "Notify" },
  { value: "sound", label: "Sound" },
];

export function AlertsCard({
  alerts,
  onChange,
  capabilities,
  onRequestPermission,
  busy,
  pushEnabled,
  onTogglePush,
  customUrl,
  onCustomUrl,
  player,
  onTestNotification,
}: AlertsCardProps) {
  const [picking, setPicking] = useState<AlertableKey | null>(null);
  const [expanded, setExpanded] = useState<AlertableKey | null>(null);

  const granted = capabilities.permission === "granted";
  const blocked = capabilities.permission === "denied";

  return (
    <>
      <Card label="Prayer alerts">
        {/* --- status -------------------------------------------------- */}
        <div
          className={`mb-3 flex items-start gap-3 rounded-xl border p-3 ${
            capabilities.canBackgroundDeliver
              ? "border-positive/30 bg-positive/10"
              : granted
                ? "border-line-strong bg-surface-2"
                : "border-critical/30 bg-critical/10"
          }`}
        >
          <span
            className={`mt-0.5 flex-shrink-0 ${
              capabilities.canBackgroundDeliver
                ? "text-positive"
                : granted
                  ? "text-muted"
                  : "text-critical"
            }`}
          >
            {capabilities.canBackgroundDeliver ? (
              <IconBell size={17} />
            ) : (
              <IconWarn size={17} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold">
              {summarizeCapabilities(capabilities)}
            </p>
            {capabilities.reasons.length > 0 && (
              <ul className="mt-1.5 space-y-1.5">
                {capabilities.reasons.map((reason, i) => (
                  <li key={i} className="text-[11.5px] leading-snug text-muted">
                    {reason}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2.5 flex flex-wrap gap-2">
              {!granted && !blocked && (
                <button
                  type="button"
                  onClick={onRequestPermission}
                  disabled={busy}
                  className="btn btn-primary !min-h-0 !py-2 text-[12.5px] disabled:opacity-50"
                >
                  {busy ? "Requesting…" : "Enable notifications"}
                </button>
              )}
              {granted && (
                <button
                  type="button"
                  onClick={onTestNotification}
                  className="btn btn-quiet !min-h-0 !py-2 text-[12.5px]"
                >
                  <IconPlay size={13} /> Send a test
                </button>
              )}
            </div>
          </div>
        </div>

        {granted && capabilities.pushManager && (
          <>
            <Row
              title="Deliver when the app is closed"
              hint={
                pushEnabled
                  ? "This device is registered for push."
                  : "Registers this device so the server can send alerts."
              }
            >
              <Segmented
                label="Background delivery"
                value={pushEnabled ? "on" : "off"}
                onChange={(v) => onTogglePush(v === "on")}
                options={[
                  { value: "off", label: "Off" },
                  { value: "on", label: "On" },
                ]}
              />
            </Row>
            <Divider />
          </>
        )}

        {/* --- per prayer ---------------------------------------------- */}
        <ul className="divide-y divide-line">
          {ALERTABLE.map((key) => {
            const setting = alerts[key];
            const meta = PRAYER_BY_KEY[key];
            const sound = getAdhanOption(setting.soundId, customUrl);
            const isOpen = expanded === key;

            return (
              <li key={key} className="py-2.5">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : key)}
                    aria-expanded={isOpen}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <IconChevron
                      size={14}
                      className={`flex-shrink-0 text-faint transition-transform ${
                        isOpen ? "rotate-90" : ""
                      }`}
                    />
                    <span className="min-w-0">
                      <span className="block text-[14px] font-semibold">
                        {meta.en}{" "}
                        <span className="font-arabic text-accent">{meta.ar}</span>
                      </span>
                      <span className="block truncate text-[11px] text-faint">
                        {setting.mode === "off"
                          ? "No alert"
                          : setting.mode === "notify"
                            ? "Notification only"
                            : sound.label}
                        {setting.offsetMinutes > 0 &&
                          ` · ${setting.offsetMinutes} min early`}
                      </span>
                    </span>
                  </button>

                  <Segmented
                    label={`${meta.en} alert`}
                    value={setting.mode}
                    options={MODE_OPTIONS}
                    onChange={(mode) => onChange(key, { ...setting, mode })}
                  />
                </div>

                {isOpen && (
                  <div className="mt-3 space-y-3 rounded-xl bg-surface p-3">
                    <Row title="Sound" hint={sound.detail}>
                      <button
                        type="button"
                        onClick={() => setPicking(key)}
                        disabled={setting.mode !== "sound"}
                        className="btn btn-quiet !min-h-0 !py-2 text-[12.5px] disabled:opacity-40"
                      >
                        Change
                      </button>
                    </Row>
                    <Divider />
                    <Row
                      title="Alert early"
                      hint="Useful if you need time to reach the masjid."
                    >
                      <Stepper
                        label={`${meta.en} lead time`}
                        value={setting.offsetMinutes}
                        min={0}
                        max={60}
                        onChange={(offsetMinutes) =>
                          onChange(key, { ...setting, offsetMinutes })
                        }
                      />
                    </Row>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {!capabilities.canBackgroundDeliver && granted && (
          <Callout icon={<IconInfo size={15} />}>
            Alerts will fire reliably while Awqāt is open. For delivery with the
            app fully closed, this device needs the Push API — see the notes
            above.
          </Callout>
        )}

        {ALERTABLE.some((key) => alerts[key].mode === "sound") && (
          <Callout icon={<IconInfo size={15} />}>
            The full adhan plays while Awqāt is open or in the background. No
            browser lets a web app play a recitation once it is fully closed —
            so at prayer time a closed app shows a notification with your
            phone&apos;s own alert sound instead of the adhan.
          </Callout>
        )}
      </Card>

      <AdhanPicker
        open={picking !== null}
        onClose={() => setPicking(null)}
        forLabel={picking ? PRAYER_BY_KEY[picking].en : ""}
        value={picking ? alerts[picking].soundId : ""}
        customUrl={customUrl}
        onChange={(soundId, url) => {
          if (url !== undefined) onCustomUrl(url);
          if (picking) onChange(picking, { ...alerts[picking], soundId });
        }}
        player={player}
      />
    </>
  );
}
