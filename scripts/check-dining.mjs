import { createHash } from "node:crypto";
import { z } from "zod";
import {
  ACTIVE_CAMPUS_ITEMS, ACTIVE_DINING_LOCATIONS, CAMPUS_ITEMS,
  DINING_LOCATIONS, DINING_SNAPSHOT, UNPRICED_MENU_ITEMS,
} from "../src/contracts/campus.ts";

// A read-only source check. campus.ts remains the only released catalog snapshot.
const TIMEOUT_MS = 15_000;
const HTTPS = z.url().refine((value) => new URL(value).protocol === "https:");
const Directory = z.array(z.object({
  conceptId: z.string().min(1),
  name: z.string().min(1),
  url: HTTPS,
  menu: HTTPS.nullable(),
})).min(1).max(1_000).refine(
  (rows) => new Set(rows.map((row) => row.conceptId)).size === rows.length,
  "Directory concept IDs must be unique",
);

async function readBytes(url, maximumBytes) {
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`HTTP ${response.status}`);
  }
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > maximumBytes) throw new Error(`Source exceeds ${maximumBytes} bytes`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function check() {
  if (process.argv.length > 2) {
    if (process.argv.slice(2).join(" ") !== "--help") throw new Error("Use node scripts/check-dining.mjs [--help]");
    console.log("Read-only check of the complete stored directory baseline and active catalog menu sources, including supplied PDFs; prints JSON. Exit 0: compared sources unchanged; 1: changes need review; 2: check incomplete. No automatic catalog updates.");
    return;
  }
  const bytes = await readBytes(DINING_SNAPSHOT.directoryUrl, 2 * 1024 * 1024);
  const upstream = Directory.parse(JSON.parse(bytes.toString("utf8"))).map((row) => ({
    id: row.conceptId, name: row.name, directoryMenuUrl: row.menu, detailUrl: row.url,
  }));
  const previous = new Map(DINING_LOCATIONS.map((row) => [row.id, row]));
  const current = new Map(upstream.map((row) => [row.id, row]));
  const added = upstream.filter((row) => !previous.has(row.id));
  const missing = DINING_LOCATIONS.filter((row) => !current.has(row.id)).map(({ id, name }) => ({ id, name }));
  const changed = upstream.flatMap((row) => {
    const before = previous.get(row.id);
    if (!before) return [];
    const fields = ["directoryMenuUrl", "detailUrl"].filter((key) => before[key] !== row[key]);
    return fields.length ? [{ id: row.id, fields: Object.fromEntries(fields.map((key) => [key, { before: before[key], after: row[key] }])) }] : [];
  });
  // The selected public menu can be a supplied CMU-hosted snapshot even when
  // the live directory has no menu link. Check those files without changing
  // the independent directory baseline or treating inactive entries as removed.
  const menus = ACTIVE_DINING_LOCATIONS.filter((row) => row.menuUrl);
  const sources = [];
  let next = 0;
  async function worker() {
    while (next < menus.length) {
      const row = menus[next++];
      const source = {
        id: row.id, name: row.name, url: row.menuUrl,
        sourceKind: row.menuUrl === row.directoryMenuUrl ? "directory-linked" : "supplied-cmu-hosted",
        directoryMenuUrl: row.directoryMenuUrl,
        sourceNote: "sourceNote" in row ? row.sourceNote : null,
        baselineSha256: row.sourceSha256 ?? null,
      };
      if (!new URL(row.menuUrl).pathname.toLowerCase().endsWith(".pdf")) {
        sources.push({ ...source, status: "not_checked", reason: "Non-PDF menu source; requires manual review" });
        continue;
      }
      try {
        const content = await readBytes(row.menuUrl, 32 * 1024 * 1024);
        if (!content.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("Response is not a PDF");
        const sha256 = createHash("sha256").update(content).digest("hex");
        const status = source.baselineSha256 === null ? "unbaselined" : source.baselineSha256 === sha256 ? "unchanged" : "changed";
        sources.push({ ...source, status, sha256 });
      } catch (error) {
        sources.push({ ...source, status: "failed", error: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  await Promise.all([worker(), worker()]);
  sources.sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
  const needsReview = added.length + missing.length + changed.length + sources.filter((source) => ["changed", "unbaselined"].includes(source.status)).length;
  const failures = sources.filter((source) => source.status === "failed").length;
  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(), snapshotDate: DINING_SNAPSHOT.checkedAt,
    directoryUrl: DINING_SNAPSHOT.directoryUrl,
    summary: {
      baselineLocations: previous.size, upstreamLocations: current.size,
      upstreamMenuLinks: upstream.filter((row) => row.directoryMenuUrl).length,
      activeLocations: ACTIVE_DINING_LOCATIONS.length,
      activePricedLocations: new Set(ACTIVE_CAMPUS_ITEMS.map((item) => item.locationId)).size,
      activePricedConfigurations: ACTIVE_CAMPUS_ITEMS.length,
      unavailablePreviewItems: UNPRICED_MENU_ITEMS.length,
      knownPriceUnavailablePreviews: UNPRICED_MENU_ITEMS.filter((item) => item.priceCents !== undefined).length,
      storedCampusConfigurations: CAMPUS_ITEMS.length,
      archivedPricedConfigurations: CAMPUS_ITEMS.length - ACTIVE_CAMPUS_ITEMS.length,
      activeMenuSources: menus.length,
      suppliedMenuSources: sources.filter((source) => source.sourceKind === "supplied-cmu-hosted").length,
      uncheckedWebMenus: sources.filter((source) => source.status === "not_checked").length,
      unchangedPdfs: sources.filter((source) => source.status === "unchanged").length,
      findingsNeedingReview: needsReview, failedChecks: failures,
    },
    directory: { added, missing, changed }, sources,
    interpretation: "Directory comparison uses all stored locations and directoryMenuUrl, independently of the requested public shortlist. PDF checks cover only active menuUrl sources, including supplied CMU-hosted snapshots that the directory does not link. Archived menu PDFs are outside this check. Hashes detect changed bytes, not changed prices; neither matched hashes nor a supplied source establish current register prices, hours, stock, popularity or availability. Display names are not compared. The catalog was not modified.",
  }, null, 2));
  process.exitCode = failures ? 2 : needsReview ? 1 : 0;
}

check().catch((error) => {
  console.log(JSON.stringify({ status: "failed", error: error instanceof Error ? error.message : String(error), catalogModified: false }, null, 2));
  process.exitCode = 2;
});
