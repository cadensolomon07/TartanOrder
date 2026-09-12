"use client";
// The loaded catalog reaches every kiosk component through this context. It is
// set once per page from server props; nothing in the UI imports the TS
// catalog files or fetches menu data itself.
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Catalog, CatalogSource } from "@/contracts";
import { indexCatalog, type CatalogIndex } from "@/catalog/lookup";

export type CatalogContextValue = { readonly menu: CatalogIndex; readonly source: CatalogSource };

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ catalog, source, children }: { catalog: Catalog; source: CatalogSource; children: ReactNode }) {
  const value = useMemo<CatalogContextValue>(() => ({ menu: indexCatalog(catalog), source }), [catalog, source]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogContextValue {
  const value = useContext(CatalogContext);
  if (!value) throw new Error("useCatalog must be used inside <CatalogProvider>.");
  return value;
}

/** Honest label for where the menu came from; the bundled fallback is never presented as live data. */
export function catalogSourceLabel(source: CatalogSource, versionId: string | null): string {
  if (source === "supabase") return `Menu: Supabase · ${versionId ?? "unknown version"}`;
  if (source === "bundled") return `Menu: bundled fallback · ${versionId ?? "unknown version"}`;
  return "Menu: unavailable";
}
