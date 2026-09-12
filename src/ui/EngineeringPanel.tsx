"use client";
import { useState } from "react";
import type { AuditEntry, OrderController } from "@/contracts";
import styles from "./Kiosk.module.css";
import { catalogSourceLabel, useCatalog } from "./CatalogContext";

export type EngineeringProps = {
  controller: OrderController;
  inputMode: "voice" | "text";
  lastTranscript: string;
  lastAsrConfidence: number | null;
  localOnly: boolean;
  onLocalOnly: (v: boolean) => void;
  voiceEngine: "cloud" | "on-device" | "none";
  onDevice: "unknown" | "unsupported" | "unavailable" | "downloadable" | "downloading" | "available";
  isBrave: boolean;
  onDownloadOnDevice: () => void;
  replay?: React.ReactNode;
};

const MAX_ROWS = 20;

function describe(e: AuditEntry): string {
  const ev = e.event;
  let what: string;
  if (ev.type === "INPUT_STARTED") what = "input started";
  else if (ev.type === "PARSE_RECEIVED") {
    const r = ev.response;
    what = `parse ${r.parser}${r.fallbackReason ? ` (fallback: ${r.fallbackReason})` : ""} → ${r.result.kind}`;
  } else {
    const a = ev.action;
    what = a.type === "MANUAL" ? `manual ${a.ops.map((o) => o.type).join(",")}` : a.type.toLowerCase();
  }
  return `#${e.seq} ${what} — ${e.outcome}${e.code ? ` [${e.code}]` : ""}`;
}

export function EngineeringPanel(p: EngineeringProps) {
  const [open, setOpen] = useState(false);
  const { menu, source } = useCatalog();
  const { state } = p.controller;
  const recent = state.audit.slice(-MAX_ROWS);

  const [serverCopy, setServerCopy] = useState<string | null>(null);

  function download(json: string, filename: string) {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportLog() {
    download(p.controller.exportLog(), `tartanorder-${state.sessionId}.json`);
  }

  /** The server's copy of this session, fetched on demand; never blocks ordering and never replaces the local log. */
  async function fetchServerLog() {
    const sessionId = state.sessionId;
    setServerCopy("Fetching the server copy…");
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/export`, { headers: { accept: "application/json" } });
      if (!response.ok) {
        setServerCopy(response.status === 404 ? "The server has no copy of this session yet." : `Server copy unavailable (HTTP ${response.status}).`);
        return;
      }
      download(await response.text(), `tartanorder-${sessionId}-server.json`);
      setServerCopy("Server copy downloaded.");
    } catch {
      setServerCopy("Server copy unavailable: the server could not be reached.");
    }
  }

  return (
    <section className={styles.eng}>
      <button
        type="button"
        className={styles.engToggle}
        aria-expanded={open}
        aria-controls="eng-body"
        data-testid="eng-toggle"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "Hide" : "Show"} engineering panel
      </button>
      {open && (
        <div id="eng-body" className={styles.engBody} data-testid="eng-body">
          <dl className={styles.engGrid}>
            <dt>Parser</dt>
            <dd data-testid="eng-parser">{p.controller.parser}</dd>
            <dt>Input mode</dt>
            <dd>{p.inputMode}</dd>
            <dt>Voice engine</dt>
            <dd data-testid="eng-voice">
              {p.voiceEngine}
              <span className={styles.muted}>
                {" "}· on-device pack: {p.onDevice}
                {p.isBrave ? " · Brave detected (no cloud speech backend)" : ""}
              </span>
            </dd>
            <dt>Menu catalog</dt>
            <dd data-testid="eng-catalog">{catalogSourceLabel(source, menu.catalog.versionId)}</dd>
            <dt>Order saving</dt>
            <dd data-testid="eng-persistence">{p.controller.persistence.state}{p.controller.persistence.message ? ` · ${p.controller.persistence.message}` : ""}</dd>
            <dt>Phase</dt>
            <dd>{state.phase}</dd>
            <dt>Session</dt>
            <dd>
              <code>{state.sessionId}</code>
            </dd>
            <dt>Revision</dt>
            <dd data-testid="eng-revision">{state.revision}</dd>
            <dt>Last line</dt>
            <dd>
              <code>{state.lastLineId ?? "—"}</code>
            </dd>
            <dt>Last transcript</dt>
            <dd>{p.lastTranscript || "—"}</dd>
            <dt>ASR confidence</dt>
            <dd data-testid="eng-asr">
              {p.lastAsrConfidence === null ? "—" : p.lastAsrConfidence.toFixed(2)}
              <span className={styles.muted}> (diagnostic, not calibrated)</span>
            </dd>
          </dl>
          <label className={styles.switchRow}>
            <input
              type="checkbox"
              checked={p.localOnly}
              data-testid="local-only"
              onChange={(e) => p.onLocalOnly(e.target.checked)}
            />
            Local only (skip the network parser)
          </label>
          {(p.onDevice === "downloadable" || p.onDevice === "downloading" || p.onDevice === "unknown") && p.voiceEngine !== "none" && (
            <button
              type="button"
              className={styles.secondaryBtn}
              data-testid="install-on-device"
              disabled={p.onDevice === "downloading"}
              onClick={p.onDownloadOnDevice}
            >
              {p.onDevice === "downloading" ? "Downloading on-device speech…" : "Download on-device speech (Chrome 139+, one-time)"}
            </button>
          )}
          <h3 className={styles.engH3}>Recent audit ({recent.length} of {state.audit.length})</h3>
          <ol className={styles.auditList} data-testid="audit">
            {recent.map((e) => (
              <li key={e.seq}>
                <code>{describe(e)}</code>
              </li>
            ))}
          </ol>
          <button type="button" className={styles.secondaryBtn} onClick={exportLog} data-testid="export-log">
            Export full log (JSON)
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={() => { void fetchServerLog(); }} data-testid="fetch-server-log" disabled={p.controller.persistence.state === "off"}>
            Fetch server copy (JSON)
          </button>
          {serverCopy && <p className={styles.muted} role="status" data-testid="server-log-notice">{serverCopy}</p>}
          {p.replay && (
            <div className={styles.replayBox}>
              <div className={styles.simTag}>Read-only replay</div>
              {p.replay}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
