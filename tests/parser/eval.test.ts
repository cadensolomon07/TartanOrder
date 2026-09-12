import { execFileSync, type ExecFileSyncOptionsWithStringEncoding } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ParseResponseSchema } from "@/contracts";
import { loadCases, resolveSplits, resolveTransport, runCases } from "../../evals/harness";
import { buildRunFile, renderMarkdown, runFileStem } from "../../evals/report";
import type { EvalTransport, RunFile } from "../../evals/types";

/**
 * The evaluation command (until A adds `npm run eval`). It measures and REPORTS accuracy; the
 * assertions below are integrity and safety properties only. Accuracy is never enforced here.
 *
 * Held-out freeze: `heldout.jsonl` is frozen until H8. It runs only when `EVAL_SPLITS` names
 * it explicitly (e.g. `EVAL_SPLITS=dev,heldout,adversarial`); the default is dev + adversarial.
 */

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const RUNS_DIR = path.join(ROOT, "evals", "runs");
const RUN_TIMEOUT_MS = 180_000;
const PARSER_LABELS = new Set(["rules", "gemini", "fixture", "n/a"]);

const SPLITS = resolveSplits(process.env);
const CONFIGURED = resolveTransport(process.env);
const WRITE = process.env.EVAL_WRITE === "1";
const EXPLICIT_SPLITS = (process.env.EVAL_SPLITS ?? "").split(",").map((value) => value.trim());

type Run = { run: RunFile; caseCount: number };

/** Short SHA plus "-dirty" when the working tree has changes; "unknown" when git is unavailable. */
function gitSha(): string {
  const options: ExecFileSyncOptionsWithStringEncoding = { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] };
  try {
    const sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], options).trim();
    // Tracked changes only: untracked notes or fresh run files cannot alter the code under test.
    const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], options).trim().length > 0;
    return dirty ? `${sha}-dirty` : sha;
  } catch {
    return "unknown";
  }
}

/** The route logs one JSON line per request; it is silenced only while cases run. */
async function execute(transport: EvalTransport, label: string): Promise<Run> {
  const cases = loadCases(SPLITS);
  const startedAt = new Date().toISOString();
  const quiet = vi.spyOn(console, "info").mockImplementation(() => undefined);
  try {
    const records = await runCases(cases, transport);
    const finishedAt = new Date().toISOString();
    const run = buildRunFile({ records, transport, label, splits: SPLITS, sha: gitSha(), startedAt, finishedAt });
    return { run, caseCount: cases.length };
  } finally {
    quiet.mockRestore();
  }
}

/** Always prints the report; writes `evals/runs/<stem>.{json,md}` only when EVAL_WRITE=1. */
function publish(run: RunFile): void {
  const markdown = renderMarkdown(run);
  console.info(markdown);
  if (!WRITE) return;
  mkdirSync(RUNS_DIR, { recursive: true });
  const stem = path.join(RUNS_DIR, runFileStem(run));
  writeFileSync(`${stem}.json`, `${JSON.stringify(run, null, 2)}\n`);
  writeFileSync(`${stem}.md`, markdown);
  console.info(`Run written: ${stem}.json and ${stem}.md`);
}

function integritySuite(name: string, enabled: boolean, transport: EvalTransport, label: string): void {
  describe.skipIf(!enabled)(name, () => {
    let result: Run | null = null;
    const current = (): Run => {
      if (result === null) throw new Error("The eval run did not complete.");
      return result;
    };

    beforeAll(async () => {
      result = await execute(transport, label);
    }, RUN_TIMEOUT_MS);

    afterAll(() => {
      if (result !== null) publish(result.run);
    });

    it("produces exactly one record per loaded case", () => {
      const { run, caseCount } = current();
      expect(run.records).toHaveLength(caseCount);
      expect(new Set(run.records.map((record) => record.id)).size).toBe(caseCount);
    });

    it("labels every record with the parser that actually answered", () => {
      for (const record of current().run.records) {
        expect(PARSER_LABELS.has(record.parser), `${record.id} parser label`).toBe(true);
      }
    });

    it("completes every case without a harness error", () => {
      const { run } = current();
      const errors = run.records.filter((record) => record.actual.kind === "harness-error");
      expect(errors.map((record) => [record.id, record.actual])).toEqual([]);
      expect(run.summary.overall.harnessErrors).toBe(0);
    });

    it.skipIf(!SPLITS.includes("adversarial"))("never leaks a proposal on adversarial input", () => {
      const { run } = current();
      const leaks = run.records.filter((record) => record.split === "adversarial" && record.expected.kind !== "cart" && record.actual.kind === "cart");
      expect(leaks.map((record) => record.id)).toEqual([]);
      expect(run.summary.bySplit.adversarial.leakedProposals).toBe(0);
    });

    it("stores only contract-valid raw responses", () => {
      for (const record of current().run.records) {
        if (record.rawResponse === null) continue;
        expect(ParseResponseSchema.safeParse(record.rawResponse).success, `${record.id} rawResponse`).toBe(true);
      }
    });

    it("runs held-out only when EVAL_SPLITS names it explicitly (frozen until H8)", () => {
      expect(SPLITS.includes("heldout")).toBe(EXPLICIT_SPLITS.includes("heldout"));
    });
  });
}

integritySuite("eval: in-process (rules grammar → pure engine)", true, { kind: "in-process" }, "rules (in-process)");

// Over HTTP the server decides rules vs gemini per request; the record carries whatever it said.
integritySuite(
  "eval: http (deployed /api/interpret → pure engine)",
  CONFIGURED.kind === "http",
  CONFIGURED,
  `http → parser per row (${CONFIGURED.kind === "http" ? CONFIGURED.baseUrl : "unset"})`,
);
