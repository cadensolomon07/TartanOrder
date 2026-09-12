import { rmSync } from "node:fs";
import { SESSION_LOG } from "./fixtures";
/** Start every run with an empty session log so teardown only sees this run's ids. */
export default function globalSetup(): void {
  rmSync(SESSION_LOG, { force: true });
}
