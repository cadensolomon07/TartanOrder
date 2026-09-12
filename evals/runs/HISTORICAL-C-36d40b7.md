# Historical workstream C evidence

These five files are preserved unchanged from `origin/work/c-gemini` at `b30e5b9` (implementation `36d40b7`). They describe C’s earlier V1 three-item-menu implementation, not the current conversational V2 release:

- [2026-09-12T05-54-53Z-http-dev+adversarial-36d40b7.json](2026-09-12T05-54-53Z-http-dev+adversarial-36d40b7.json)
- [2026-09-12T05-54-53Z-http-dev+adversarial-36d40b7.md](2026-09-12T05-54-53Z-http-dev+adversarial-36d40b7.md)
- [2026-09-12T05-54-53Z-in-process-dev+adversarial-36d40b7.json](2026-09-12T05-54-53Z-in-process-dev+adversarial-36d40b7.json)
- [2026-09-12T05-54-53Z-in-process-dev+adversarial-36d40b7.md](2026-09-12T05-54-53Z-in-process-dev+adversarial-36d40b7.md)
- [gemini-live-2026-09-12T05-31-14-817Z.json](gemini-live-2026-09-12T05-31-14-817Z.json)

The recorded live model was Gemini 3.8 Flash, with the old five-second server deadline and pre-model quantity, injection, and repeated-item guards. Some HTTP rows therefore record rules decisions or rules fallback. Read each record’s actual parser and fallback fields; the HTTP report is not an all-Gemini accuracy result.

The current V2 implementation uses cart/conversation context, the expanded menu, Gemini 3.6 Flash verified with the configured account, a longer deadline, unavailable notices, and contextual clarification. It intentionally does not restore C’s pre-model grammar dispatch. These historical metrics must not be presented as V2 accuracy, production verification, or human microphone results. Separate `live-app-gemini-*` records describe the newer application checks.

C’s documented provider fixes (larger output budget and provider schema compatibility) are incorporated independently in V2. The preserved runs and historical note do not change runtime behavior. No heldout evaluation was read or run during this preservation.
