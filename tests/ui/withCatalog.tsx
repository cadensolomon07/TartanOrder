// Test-only wrapper: the kiosk reads the catalog from context, exactly as the
// page provides it from server props.
import type { ReactNode } from "react";
import type { Catalog, CatalogSource } from "@/contracts";
import { CatalogProvider } from "@/ui/CatalogContext";
import { CATALOG } from "../helpers/catalog";

export function withCatalog(children: ReactNode, source: CatalogSource = "bundled", catalog: Catalog = CATALOG) {
  return <CatalogProvider catalog={catalog} source={source}>{children}</CatalogProvider>;
}
