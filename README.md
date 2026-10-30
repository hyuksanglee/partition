<p align="center">
  <img src=".claude-plugin/icon.png" width="140" alt="Partition">
</p>

<h1 align="center">Partition</h1>

<p align="center">
  <em>One limit. Many projects. Everyone gets their share.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/hyuksanglee/partition?style=flat-square&color=111111&label=stars" alt="Stars">
  <img src="https://img.shields.io/badge/Claude%20Code-plugin-111111?style=flat-square" alt="Claude Code plugin">
  <img src="https://img.shields.io/badge/Codex-plugin-111111?style=flat-square" alt="Codex plugin">
  <img src="https://img.shields.io/badge/node-18%2B-111111?style=flat-square" alt="Node 18+">
  <img src="https://img.shields.io/badge/status-experimental-111111?style=flat-square" alt="Experimental">
  <img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MIT license">
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/settings-dark.jpg">
    <img src="assets/settings-light.jpg" width="560" alt="The Partition settings window: the 5-hour limit as one bar. api-server has used 12 of its 40pp, docs 0 of 10pp, web-app 18.4 of 30pp; the used part of each share is solid and the rest striped. Gray at the right end is usage no budget covers (15.6pp). web-app is selected and can be given 0 to 34.4pp.">
  </picture>
</p>

<p align="center">
  <strong>Give each project a share of your Claude Code or Codex 5-hour and weekly limits.</strong><br>
  <strong>Near the line it warns, asks the assistant to wrap up, then stops that project.</strong><br>
  <sub>The other projects keep working.</sub>
</p>

<p align="center">
  <sub><a href="i18n/README.ko.md">한국어</a></sub>
</p>

---

You know how it goes. Three projects open. One of them goes on a long refactor, and by mid-afternoon the 5-hour limit is at 100%. The other two wait until evening.

Your plan's limits are one pool for everything. Partition splits that pool, like giving each container its own slice of memory: `web-app` gets 30pp, `api-server` 40pp, and when `web-app` has used its 30, it stops. `api-server` still has its 40.

## Numbers

Why a budget in percent, and why it has to act early. Measured from the author's own Codex records (119 sessions, 1,381 requests; per-request change measurable for 300 of them), not from Claude Code:

| | Median | p90 | Max |
| --- | --- | --- | --- |
| 5-hour limit used by **one request** | 0% | 9% | **91%** |
| 5-hour limit used between two steps | 1% | 3% | 25% |

- **One request can eat most of the limit.** Waiting until 100% is too late; Partition steps in before.
- **Tokens per 1% differed about 6× between models** (roughly 40k to 230k). A budget in tokens would mean something different for every model, so Partition budgets in percentage points of the limit itself.
- **Usage usually rises 1–3% per step.** That is why Claude is asked to wrap up **3pp** before the budget by default.

Method and caveats: [docs/usage-analysis.md](docs/usage-analysis.md) (Korean).

## Before / after

An example, with `web-app` given 30pp of the 5-hour limit:

| | Without Partition | With Partition |
| --- | --- | --- |
| `web-app` at 24pp | keeps going | you get one warning |
| `web-app` at 27pp | keeps going | Claude is told to finish the current task and summarize what is left |
| `web-app` at 30pp | keeps going until the whole limit is gone | new requests and tool calls in `web-app` are blocked |
| `api-server` | waits for the reset | still has its own 40pp |

## How it works

Claude's integration is described below. Codex reads local session usage through
lifecycle hooks; see [Codex desktop](#codex-desktop-experimental). Each provider
has its own account pool, budgets, and usage records.

```
 status line            hooks
 ───────────            ─────
 after every response   before every prompt and tool call
   │                      │
   ├─ reads rate_limits   ├─ /partition:* command? → run it, Claude shows it
   ├─ reads new tokens    ├─ 80% of budget  → warn once
   │  from the transcript ├─ 3pp before     → ask Claude to wrap up
   └─ splits the increase ├─ at budget      → block
      by token share      └─ no data / error → let it through
```

1. **The status line sees the usage.** Claude Code passes it `rate_limits` (5-hour and weekly percent, reset time) after every response. Hooks do not get these values, so the status line saves them to `~/.partition/`.
   The desktop app's Code tab does not run status lines. There, a background `Stop` hook runs `claude -p "/usage"` after each response instead: it prints the same percentages without calling the model (0 tokens; about 1–2 seconds when measured).
2. **The increase is split by tokens.** The status line also reads the session's new transcript lines and adds their tokens to that project's pending count. When the account percentage goes up, each project gets a share in proportion to its pending tokens.
3. **Hooks act on it.** Before every prompt and tool call, Partition checks the project's share against its budget.

Honest, not exact:

- **It is a self-imposed limit.** Anthropic's servers own the real limits. Partition counts on your machine and stops itself.
- **It can overshoot by one step.** It acts between responses and tool calls, not in the middle of one.
- **The token weights are an assumption.** Input 1, cache write 1.25, cache read 0.1, output 5, borrowed from API price ratios. Change them in `~/.partition/config.json`.
- **Usage it cannot place is shown as such.** Claude on the web or another device shows up as *unattributed*; usage from before Partition started counting, as *other*.
- **When it is unsure, it lets you through.** No data yet, a window that has reset, or an error in Partition never blocks you. Neither do Partition's own commands.

## The settings window

`/partition:ui` opens a small window (a native WebKit window on macOS; elsewhere Chrome app mode or your browser).

- **One bar for the whole limit.** Each project's share is drawn in its color: **solid** for what it has used, **striped** for what is still left.
- **Gray from the right end** is usage no budget covers: from before Partition, from the web or other devices, and from projects without a budget. It is already spent, so nobody can be given it.
- **The line under the bar** shows how much the selected project can be given: after the other projects' shares, up to where the gray starts.
- Drag the slider or type a number; the bar updates as you go. **Nothing is saved until you press Save** in the bar at the bottom. `0` means no limit.
- A budget may be lower than this project's recorded usage. Before saving, the
  page explains whether subsequent prompts and tool calls will be blocked.
- The native window stays open while you edit, until you close it. Browser pages
  send independent heartbeats, including when an unsaved draft pauses refresh.
- **Rules** sets when to warn, when to ask Claude to wrap up, whether to block, and the language. **Connection** shows the status line setup.

## /partition:status

```
Partition · web-app

5-hour · resets 10/29 19:30
  This project  ███████████████░░░░░░░░░  18.4 / 30pp
  Account       ███████████░░░░░░░░░░░░░  46%
                ├ web-app     18.4pp
                ├ api-server    12pp
                └ other       15.6pp
```

Projects are listed by folder name, the current one first. Rows that are 0 are left out. Messages follow your system language (Korean or English), or the language you pick in **Rules**.

## The status line (terminal)

```
[web-app 18.4/30%p · 5h 46%]
```

`web-app` has used 18.4 of its 30pp, and the account is at 46% of the 5-hour limit. A weekly budget adds `· 7d 9/20%p`. If you already had a status line, it keeps running and Partition sits next to it. The desktop app's Code tab does not show status lines.

## Install

For Codex, use the [two-command marketplace installation](#codex-desktop-experimental).
The steps here are for Claude Code.

**Claude Code**, as two separate prompts:

```
/plugin marketplace add hyuksanglee/partition
```
```
/plugin install partition@partition
```

In the terminal, also connect the status line (the desktop app's Code tab does not need it):

```
/partition:setup
```

Plugins cannot set a status line themselves, so this changes `statusLine` in `~/.claude/settings.json`. Claude shows the exact change first and applies it only after you say yes.

Then give the project you are in a share:

```
/partition:budget 30
```

Needs a **Pro or Max** plan (usage percentages only come to subscribers), **Node.js 18+**, and macOS or Linux. In the desktop app, the `claude` command must be installed too (on `PATH` or in `~/.local/bin`).

## Commands

| Command | What it does |
| --- | --- |
| `/partition:ui` | Open the settings window (see above). |
| `/partition:status` | This project's usage as bar graphs, with every project's share of the account usage. |
| `/partition:budget <1-100 \| 0> [--week]` | Set this project's share of the 5-hour limit, or the weekly one with `--week`. `0` (or `off`) removes the limit. |
| `/partition:setup` | Connect the status line (terminal). Shows the change first. |

`ui`, `status` and `budget` run in a hook before Claude sees the prompt; Claude only shows the result, without tools. That costs one short response (measured: $0.11 in a fresh `claude -p` session; more in a long conversation, because Claude rereads it). A hook could answer with no model call at all, but then Claude Code labels every answer "blocked by hook", which reads like an error.

A project is the top of the git repository you are in, or the folder itself if there is none.

The same commands work in a terminal, also without tokens: `node <plugin folder>/src/cli.mjs help`.

## FAQ

**Does it actually split my plan's limit?**
No. Each provider manages its own account limit. Partition keeps count per project on your machine and stops a project that has used its share. Claude and Codex budgets are independent.

**Will it stop exactly at 30pp?**
No. It acts between steps, so it can go over by one response or tool call. The wrap-up step 3pp early is there to make that small.

**What if Partition breaks?**
It lets you through. A missing value, a reset window or an error in Partition never blocks you.

**Does it send my data anywhere?**
No. Everything stays in `~/.partition/`.

**Does it work in the Claude desktop app?**
The commands and hooks do. The Code tab does not run status lines, so Partition reads usage after each response with `claude -p "/usage"` instead. That output is meant for people, not programs: if its wording changes, Partition stops counting there and lets everything through until it is updated.

**Codex?**
An experimental desktop adapter is included. See [Codex desktop](#codex-desktop-experimental) below; its budgets and usage are separate from Claude's.

**How do I remove it?**
`/partition:ui` → **Connection** → **Restore** puts your original status line back. Then `/plugin uninstall partition@partition`, and delete `~/.partition/` if you like.

**Why "Partition"?**
A disk has one size. You still give each part its own.

## Status

Experimental. Checked on Claude Code 2.1.312 with a Pro plan (2026-10-29):

- [x] In the terminal, interactive and `claude -p`, `/partition:*` commands are run by the hook before the model.
- [x] The status line receives real `rate_limits` values.
- [x] Claude followed the wrap-up instruction and did not start new work (once in `claude -p`, and in the Code tab).
- [x] In the desktop app's Code tab, `/partition:*` commands are run by the hook too.
- [x] The Code tab does **not** run custom status lines (`settings.json` pointed to Partition, nothing ran).
- [x] `claude -p "/usage"` returns the 5-hour and weekly percentages with 0 tokens.
- [x] In the Code tab, Partition's background `Stop` hook records those values after each response.
- [x] The account increase was split between two projects by their tokens (Code tab, real usage).
- [ ] Blocking at the budget, checked with real usage.
- [ ] How closely the per-project split matches real usage over a full window.

Results and problems are welcome in [Issues](https://github.com/hyuksanglee/partition/issues).

## Codex desktop (experimental)

Install from the repository marketplace:

```bash
codex plugin marketplace add hyuksanglee/partition
codex plugin add partition@partition
```

Review and trust Partition's bundled hooks in Codex (`/hooks` in the CLI, or
the Partition settings Connection tab), then start a new local desktop chat.
Enter `/partition:ui` to open settings; `$partition:ui` is also a bundled skill.
On macOS, the UI command opens a separate `Partition.app` window and confirms
its name, icon, and readiness before reporting success. On other systems it
uses Chrome app mode or the default browser. A browser panel is an explicit
alternative via `ui --serve`.
`/partition:status` shows usage; `/partition:budget 30` assigns this project 30pp.
Node.js 18+ must be available on the hook process's PATH.
Use a Codex version with plugin commands and a local desktop engine supporting
lifecycle hooks. The desktop connection requires local execution.

If using the earlier standalone setup, remove its handlers from that checkout
with `node src/cli.mjs --provider codex uninstall --apply` before enabling the
plugin's hooks. Budgets and usage records are kept. Choose one hook installation
mode to avoid duplicate callbacks.

The Codex adapter reads `token_count` events in local session JSONL files and
uses the same budget rules and settings window. It does not make model calls to
collect usage. Claude keeps its existing data in `~/.partition/`; Codex uses
`~/.partition/codex/` with separate budgets, rules, weights, and usage windows.

For development without plugin installation, preview the standalone connection:

```bash
node src/cli.mjs --provider codex setup --plan
node src/cli.mjs --provider codex setup --apply
```

This adds Partition's handlers to `$CODEX_HOME/hooks.json` (normally
`~/.codex/hooks.json`) and preserves other hooks. Open the settings window and
choose **Connection → Check status**. Review the displayed commands, check the
consent box, and select **Trust reviewed hooks and connect**. This uses the
desktop engine's `hooks/list` and `config/batchWrite` APIs; it approves only the
displayed Partition definitions and preserves unrelated config. Changed
definitions must be reviewed again. You can alternatively use `/hooks` in the CLI.
Then start a new local desktop chat.
Hook registration is separate from trust and actual execution. Cloud chats
without local orchestration are outside this adapter's scope.

```bash
node src/cli.mjs --provider codex ui --detach --project /path/to/project
node src/cli.mjs --provider codex budget 30 --project /path/to/project
node src/cli.mjs --provider codex status --project /path/to/project
node src/cli.mjs --provider codex uninstall --plan
node src/cli.mjs --provider codex uninstall --apply
```

Uninstall removes only Partition's standalone hook handlers. Project budgets are
optional: hooks track usage but do not block a project until it has a budget.
The connection tab shows whether a hook execution has been observed.
Codex `ui --detach` opens the same separate native WebKit window as Claude on
macOS, and reports success only after that window acknowledges readiness.
The shared window runs as `Partition.app`, with Partition's own Dock name and
icon. macOS's built-in tools prepare and cache the app on first launch.
The Dock artwork includes transparent margins to match other app icons.
Connected installations open Budget first; connections needing setup or trust
open Connection. You can set a budget below the project's recorded usage. The
page explains the effect before saving, including whether blocking is enabled;
account usage from before tracking is excluded. A value of `0` removes the limit.
For an in-app browser panel, `node src/cli.mjs --provider codex ui --serve`
prints a local settings URL and keeps its server running. Open that URL in the
app panel; review and approval then happen in the page without terminal input.

`.agents/plugins/marketplace.json` exposes the repository as a Codex marketplace;
`.codex-plugin/plugin.json` references `hooks/codex.json` and `codex-skills/`.
The bundled `$partition:ui` skill opens the settings window even when a hook hasn't handled
the command. If a literal `/partition:*` prompt reaches
`UserPromptSubmit`, the hook handles it; slash-command routing in a particular
client is not assumed. Terminal commands above work independently of that UI.

Current verification: automated protocol, parsing, attribution, setup/restore,
and Claude regression tests; local desktop JSONL reading and isolated CLI plugin
installation checked. The installed desktop engine also passed an isolated
integration test that approves fixture hooks and reports a budget-exhausted
prompt as blocked before model generation. The current user's hook approval is
separate and requires their explicit review. Actual account-window attribution
accuracy still needs real-usage observation. The transcript format is not a stable API; unknown quota
buckets are ignored. Hosted tools and some specialized paths do not run tool
hooks, and an in-flight model request cannot be stopped mid-response. Missing
transcripts, expired windows, and integration errors fail open.

Validation on 2026-10-30: 98 automated tests and TypeScript checks pass. Tests
cover marketplace installation, hook trust and enforcement, separate usage
pools, native app identity/signature/icon, default tabs, and lower-budget saves.
The native window was also kept open with an unsaved draft for over two minutes.

References: [Codex hooks](https://learn.chatgpt.com/docs/hooks),
[plugin packaging](https://developers.openai.com/plugins/build/plugins).

## Development

```bash
npm install          # dev only: TypeScript for type checking
npm test
npm run typecheck
claude --plugin-dir .
```

Plain JavaScript, no runtime dependencies, no build step. Design notes: [docs/DESIGN.md](docs/DESIGN.md).

## License

[MIT](LICENSE). Take your share.
