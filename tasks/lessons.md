# Lessons

## 2026-09-12 — Supabase plan corrections

- **Use Supabase's current API keys, never the legacy JWTs.** I named `SUPABASE_SERVICE_ROLE_KEY` from memory; the user corrected it. Supabase's current keys are `sb_publishable_…` (replaces `anon`) and `sb_secret_…` (replaces `service_role`); the legacy pair is deprecated. Rule: before naming any third-party credential or env var, check the vendor docs (Context7 or the vendor MCP) and the repo's existing `.env.example`, which here already had `SUPABASE_PUBLISHABLE_KEYS` / `SUPABASE_SECRET_KEYS`.
- **Do not add local infrastructure the user did not ask for.** I planned a Docker-based local Supabase stack for tests; the user does not want one. Rule: default to the resource that already exists (the TartanHacks project) and gate database tests on env keys with cleanup, unless the user asks for isolation.
- **Re-check the working tree before finalising a plan.** A commit reshaping the catalog (`551651c`) landed mid-session and changed the counts, version id and schema my plan quoted. Rule: run `git status` and `git log -1` immediately before writing counts or version strings into a plan or acceptance criterion.

## 2026-09-12 — implementation

- **Do not write files with backslash sequences through a Python heredoc.** Inside a quoted heredoc, Python source `"\\n"` is a literal backslash-n; I corrupted package.json and a regex-heavy script that way, and the aborted script skipped later edits. Rule: write whole files with a quoted shell heredoc; use Python only for exact-string replacements, and never chain an unrelated edit after an assertion that can fail.
- **Reruns after review fixes are the evidence, not the earlier green runs.** Route code changed after the first end-to-end pass, so the build, both browser suites and the live database test were rerun before reporting.

## 2026-09-12 — merge

- **Never stage a conflicted file without checking for markers first.** A typo aborted my resolution script, yet the following `git add` staged the files with `<<<<<<<` markers still inside. Rule: resolve, then `grep -l '^<<<<<<<'` must print nothing, then stage; keep the resolution and the staging in separate commands.
- **A data change upstream means a new catalog version, not an edit.** Upstream changed a demo item and bumped the version string; the immutable catalog design meant publishing a second version and activating it, which the seed script already supported.
