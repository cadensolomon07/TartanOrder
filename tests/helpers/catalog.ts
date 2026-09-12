// Shared test catalog: the bundled release, validated once. Tests never load
// the database; the DB-backed loader is covered with a mocked client.
import { bundledCatalog, BUNDLED_VERSION_ID } from "@/catalog/bundled";
import { indexCatalog } from "@/catalog/lookup";

export const CATALOG = bundledCatalog();
export const MENU_VERSION = BUNDLED_VERSION_ID;
export const MENU = indexCatalog(CATALOG);
