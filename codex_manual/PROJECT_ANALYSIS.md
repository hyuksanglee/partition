# Partition project analysis

## 1. Directory Structure (Tree)

```text
.claude-plugin/          Claude plugin identity and marketplace
.codex-plugin/           Codex compatibility manifest
.agents/plugins/        Codex repository marketplace catalog
hooks/                  Separate Claude and Codex lifecycle hook definitions
skills/                 Claude setup, UI, status, and budget workflows
codex-skills/            Codex Partition management workflow
src/
  core/                 Pure window, attribution, allocation, and stage calculations
  store/                Configuration, state, paths, locking, atomic JSON writes
  commands/             Operations shared by CLI, hooks, and settings UI
  claude/               Claude hook, status line, usage fetch, transcript, and setup
  codex/                Codex hook, incremental JSONL usage collection, and setup
  ui/                   Loopback server, native window launcher, static page
  cli.mjs               Terminal entry point
  project.mjs           Git root or working directory project identity
  messages.mjs          Korean/English messages and formatting
test/                   Node tests, mirroring source modules
docs/                   DESIGN.md, HANDOFF.md, usage-analysis.md
i18n/                   Korean README
```

## 2. Tech Stack & Environment

- JavaScript ESM (`.mjs`), Node.js 18+, no runtime dependencies or build step.
- JSDoc checked with TypeScript through `jsconfig.json` (`strict`, `checkJs`).
- Tests: `npm test`; type checks: `npm run typecheck`.
- macOS native settings window uses JXA/WebKit; browser fallback on other systems.
  Built-in `osacompile`, `iconutil`, and `codesign` prepare a real Partition.app
  in the provider's `native/<content-hash>/` cache. Both providers reuse the
  Partition icon (`.claude-plugin/icon.png`) and `io.partition.settings` identity.
- Claude state defaults to `~/.partition/`; `PARTITION_HOME` overrides that base
  for tests. `PARTITION_PROVIDER=codex` selects its separate `codex/` subdirectory.
  CLI `--provider codex` selects the same pool before any configuration I/O.
- Claude integration uses subscription usage percentages, not API billing.

## 3. Component/Module Description

- `core/window.mjs`: detects reset/expiry, accumulates pending token weights, attributes percentage increases.
- `core/attribute.mjs`: splits increases by each project's pending weight.
- `core/allocation.mjs`: computes available project budget and accounts for other usage.
- `core/stages.mjs`: warning, wrap-up, and block thresholds.
- `store/config.mjs`: budgets, rules, weights, language; preserves defaults.
- `store/state.mjs`: windows and incremental transcript cursors; install metadata.
- `store/file.mjs`: synchronous locks, stale lock cleanup, atomic writes.
- `commands/`: reusable status, budget, rules, setup, and UI operations.
- `claude/statusline.mjs`: records fresh usage and transcript tokens; wraps existing status line.
- `claude/hook.mjs`: commands and lifecycle enforcement; Stop fetches usage for desktop Code.
- `claude/settings.mjs`: setup preview/application/restore of the user's status line.
- `codex/transcript.mjs`: complete-line incremental reader with a bounded read;
  cumulative token deltas avoid repeated-notification double counting. Input
  includes cached tokens; output includes reasoning, so neither is counted twice.
- `codex/usage.mjs`: reads known session cursors under one lock, sorts events by
  timestamp, ignores stale readings, updates Codex-only account windows.
- `codex/hook.mjs`: SessionStart guidance, prompt and local-tool policy, Stop
  collection without continuation. Selects `codex` before storage access.
- `codex/settings.mjs`: merges/removes only owned standalone handlers in
  `$CODEX_HOME/hooks.json`, refuses malformed JSON, leaves trust to the user.
- `codex/app-server.mjs`: short-lived JSON-RPC control client using the installed
  GPT desktop engine. Initializes the protocol, bounds RPC time, cleans up child
  processes, and does not generate model responses for setup.
- `codex/desktop.mjs`: lists owned hooks, fingerprints the reviewed definitions,
  and saves user-approved hashes through `config/batchWrite`. Approval requires
  explicit consent, a fresh fingerprint, and the user's config version. Other
  hook states and global security settings remain untouched.
- Codex plugin and standalone user hooks are both supported by the review page;
  plugin definitions are preferred when both sources are discovered. Never
  automatically grant trust while installing or migrating a plugin.
- `ui/server.mjs`: token-protected HTTP API on `127.0.0.1`, exact Host checking.
  A live native child owns server lifetime; only browser pages use idle cleanup.
  Page heartbeats run independently of data refresh and unsaved budget drafts.
- `ui/mac-app.mjs`: atomically prepares and reuses the signed JXA app bundle;
  its own executable, Info.plist, and ICNS provide the actual Dock name/icon.
- `ui/mac-icon.js`: uses existing Cocoa drawing to center the Dock artwork at
  824 × 824 within a transparent 1024 × 1024 canvas. Marketplace artwork remains
  unchanged; renderer changes invalidate the native app cache as well.
- `ui/page/`: vanilla HTML/CSS/JavaScript, no frontend framework.
  The page imports pure tab/budget presentation policy from `policy.mjs`.
  Completed connections open Budget by default; missing registration/trust opens
  Connection. Explicit tab URLs and user navigation take precedence.

## 4. Data Flow & Architecture

1. Integration reads usage percentages and incremental transcript tokens.
2. Store lock protects cursor/state changes; pure core functions update windows.
3. Percentage growth is distributed by pending weights, then pending counts clear.
4. `commands/check.mjs` evaluates project usage against configured budgets.
5. Hooks warn, inject wrap-up instructions, or block supported prompt/tool paths.
6. CLI and GUI call shared commands instead of duplicating budget calculations.
7. Codex records usage before prompt/tool checks and after tools/Stop, reading
   `transcript_path`; named quota buckets other than `codex` are ignored.
   Plugin hooks and standalone setup are alternative installation modes.
8. The settings Connection tab obtains live trust metadata through authenticated
   loopback endpoints. Its initially unchecked consent box gates approval. The
   server re-reads definitions and preserves unrelated settings before saving.
   `ui --serve` exposes this same page to the GPT app's browser panel.
9. Codex `ui --detach` starts the shared native-window path in a detached worker.
   On macOS the compiled JXA app acknowledges readiness after its NSWindow is
   visible and reports its runtime name, bundle ID, and icon status. The launcher
   rejects an unexpected identity (including `osascript`); the
   worker then returns `{url, mode}`. Startup errors do not produce a success
   response. Hooks and skills report the result without opening a browser panel.
   `ui --serve` remains an explicit browser-page alternative. Closing the native
   window closes its server; closing the server also terminates its window.
   Native windows do not time out when page refresh pauses during editing,
   background timer throttling, or system sleep. Browser heartbeats are separate
   from refresh, so preserving a draft cannot accidentally expire its server.
10. Budget amounts below a project's attributed usage remain valid. Before
    saving, the UI shows whether subsequent requests will block or blocking is
    disabled. Zero still removes the budget. Only live project usage is used,
    excluding account totals and pre-tracking usage. Save rechecks fresh state;
    newly discovered consequences are shown before the user saves again.

Preserve `core` as environment/file-I/O free. Integrations use `store`, `core`, and
shared commands. Provider-specific collection and setup belong in their own
integration folder. Claude and Codex have separate account pools and must never
share usage windows or budget totals.

## 5. AI Context Guide (AI가 작업을 위해 알아야 할 핵심 규칙)

- Read this guide, then relevant code/tests; `docs/DESIGN.md` and `docs/HANDOFF.md`
  explain design history and verification limits, not necessarily current state.
- Follow the existing Node-only stack and module boundaries; no new libraries.
- Keep existing Claude data paths and behavior backward compatible.
- Percent budgets are percentage points of the subscription window; token weights
  are an attribution assumption, not an exact representation of account cost.
- Missing data, expired windows, and integration errors must fail open.
- Partition's own recovery commands must remain available at budget exhaustion.
- Setup must show concrete changes and preserve unrelated settings on restore.
- Verify actual hook input/output against current official Codex documentation.
  Transcript JSONL is an unstable local interface; parse defensively.
- Never read or print authentication secrets. Inspect only usage/session metadata
  when checking local session format.
- Run relevant regression tests and `npm run typecheck` before finishing.
- Distinguish simulated protocol tests from real desktop lifecycle verification;
  hook trust is a user-controlled runtime requirement.
- `test/codex/desktop-engine.test.mjs` uses an isolated temporary CODEX_HOME and
  the installed engine. It approves fixture hooks and verifies the actual
  `hook/completed` blocked status, without generating a model response.
- `test/codex/plugin.test.mjs` verifies the two-command marketplace installation,
  cached plugin hooks and namespaced skills, consented fixture trust, and the
  installed `/partition:ui` hook's readiness handshake and token-protected URL
  with a simulated native launcher. Actual macOS window visibility is verified
  separately; startup-failure regression tests prevent false success reports.
- `test/ui/mac-app.test.mjs` compiles the real bundle and checks its name,
  executable, icon declaration, valid signature, and cache reuse. Native-launch
  fixtures reject both early exits and a misleading `osascript` identity.
- Update this guide when introducing an integration or changing storage/data flow.

- [x] Directory structure and stack identified
- [x] Module ownership and entry points mapped
- [x] Usage attribution, persistence, and enforcement flow documented
- [x] Validation commands and integration risks recorded
