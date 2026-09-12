"use client";
import { T } from "./Language";
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
  voiceEngine: "cloud" | "on-device" | "gemini" | "none";
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
        <T>{open ? "Hide" : "Show"} engineering panel
      </T></button>
      {open && (
        <div id="eng-body" className={styles.engBody} data-testid="eng-body">
          <p className={styles.muted}><T>An explicit log download includes transcripts and food requirements. Keep it private unless you choose to share it.</T></p>
          <dl className={styles.engGrid}>
            <dt><T>Parser</T></dt>
            <dd data-testid="eng-parser"><T>{p.controller.parser}</T></dd>
            <dt><T>Input mode</T></dt>
            <dd><T>{p.inputMode}</T></dd>
            <dt><T>Voice engine</T></dt>
            <dd data-testid="eng-voice">
              <T>{p.voiceEngine}</T>
              <span className={styles.muted}>
                <T>{" "}· on-device pack: {p.onDevice}</T>
                <T>{p.isBrave ? " · Brave detected (no cloud speech backend)" : ""}</T>
              </span>
            </dd>
            <dt><T>Menu catalog</T></dt>
            <dd data-testid="eng-catalog"><T>{catalogSourceLabel(source, menu.catalog.versionId)}</T></dd>
            <dt><T>Order saving</T></dt>
            <dd data-testid="eng-persistence"><T>{p.controller.persistence.state}{p.controller.persistence.message ? ` · ${p.controller.persistence.message}` : ""}</T></dd>
            <dt><T>Phase</T></dt>
            <dd><T>{state.phase}</T></dd>
            <dt><T>Session</T></dt>
            <dd>
              <code><T>{state.sessionId}</T></code>
            </dd>
            <dt><T>Revision</T></dt>
            <dd data-testid="eng-revision"><T>{state.revision}</T></dd>
            <dt><T>Last line</T></dt>
            <dd>
              <code><T>{state.lastLineId ?? "—"}</T></code>
            </dd>
            <dt><T>Last transcript</T></dt>
            <dd>{p.lastTranscript || "—"}</dd>
            <dt><T>ASR confidence</T></dt>
            <dd data-testid="eng-asr">
              <T>{p.lastAsrConfidence === null ? "—" : p.lastAsrConfidence.toFixed(2)}</T>
              <span className={styles.muted}><T> (diagnostic, not calibrated)</T></span>
            </dd>
          </dl>
          <label className={styles.switchRow}>
            <input
              type="checkbox"
              checked={p.localOnly}
              data-testid="local-only"
              onChange={(e) => p.onLocalOnly(e.target.checked)}
            /><T>
            Local only (skip the network parser)
          </T></label>
          <T>{(p.onDevice === "downloadable" || p.onDevice === "downloading" || p.onDevice === "unknown") && p.voiceEngine !== "none" && (
            <button
              type="button"
              className={styles.secondaryBtn}
              data-testid="install-on-device"
              disabled={p.onDevice === "downloading"}
              onClick={p.onDownloadOnDevice}
            >
              <T>{p.onDevice === "downloading" ? "Downloading on-device speech…" : "Download on-device speech (Chrome 139+, one-time)"}</T>
            </button>
          )}</T>
          <h3 className={styles.engH3}><T>Recent audit ({recent.length} of {state.audit.length}</T>)</h3>
          <ol className={styles.auditList} data-testid="audit">
            <T>{recent.map((e) => (
              <li key={e.seq}>
                <code><T>{describe(e)}</T></code>
              </li>
            ))}</T>
          </ol>
          <button type="button" className={styles.secondaryBtn} onClick={exportLog} data-testid="export-log"><T>
            Export full log (JSON)
          </T></button>
          <button type="button" className={styles.secondaryBtn} onClick={() => { void fetchServerLog(); }} data-testid="fetch-server-log" disabled={p.controller.persistence.state === "off"}><T>
            Fetch server copy (JSON)
          </T></button>
          <T>{serverCopy && <p className={styles.muted} role="status" data-testid="server-log-notice"><T>{serverCopy}</T></p>}</T>
          <T>{p.replay && (
            <div className={styles.replayBox}>
              <div className={styles.simTag}><T>Read-only replay</T></div>
              <T>{p.replay}</T>
            </div>
          )}</T>
        </div>
      )}
    </section>
  );
}
