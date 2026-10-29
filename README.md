# Partition

**Per-project budgets for your Claude Code usage limits.**

[한국어](README.ko.md)

Claude Pro and Max plans have a 5-hour limit and a weekly limit shared by everything you do. When you work on several projects at once, one project can use the whole limit and leave nothing for the others.

Partition lets you give each project a share of each limit, in percentage points (pp), like assigning memory to containers. When a project gets close to its share, Partition warns you, asks Claude to wrap up, and then blocks new requests for that project.

> [!WARNING]
> **Experimental.** Checked so far (Claude Code 2.1.312, Pro plan, 2026-10-29):
> - In the terminal, both interactive and `claude -p`, `/partition:*` commands are handled by the hook before the model is called.
> - The status line receives real `rate_limits` values.
> - In one test, Claude followed the wrap-up instruction and did not start the new work.
>
> Not confirmed yet:
> - whether the Claude desktop app's Code tab runs custom status lines (if it does not, usage there is not counted)
> - how closely the per-project split matches real usage
>
> Reports are welcome in [Issues](https://github.com/hyuksanglee/partition/issues).

## What it is, and what it is not

- **It is a self-imposed limit on your own computer.** Anthropic's servers enforce the real limits; Partition cannot split them. It counts usage per project locally and stops that project when it reaches the budget you set.
- **It cannot stop exactly on the line.** It acts between steps, so a project can go over its budget by one response or tool call.
- **If something is missing or broken, it lets you through.** No usage data yet, a window that has reset, or an error in Partition itself never blocks you.

## Requirements

- Claude Code with a **Pro or Max** subscription (usage percentages are only given to subscribers, and only after the first response in a session)
- **Node.js 18+** on your `PATH`
- macOS or Linux (Windows is not supported yet)

## Install

In Claude Code:

```
/plugin marketplace add hyuksanglee/partition
/plugin install partition@partition
```

Then connect the status line:

```
/partition:setup
```

Plugins cannot set a status line themselves, so this step changes `statusLine` in `~/.claude/settings.json`. Claude shows you the exact change first and applies it only after you approve. If you already have a status line, Partition keeps running it and shows its own part next to it.

## Use

| Command | What it does |
| --- | --- |
| `/partition:ui` | Open the settings window |
| `/partition:status` | This project's usage and budget |
| `/partition:budget 30` | Give this project 30pp of the 5-hour limit |
| `/partition:budget 20 --week` | Give this project 20pp of the weekly limit |
| `/partition:budget off` | Remove this project's budget |
| `/partition:setup` | Connect the status line (asks first) |

`ui`, `status` and `budget` are handled by a hook before the model is called, so they use no tokens. Claude Code shows "operation blocked by hook" with the result; that is expected.

A **project** is the top of the git repository you are in, or the current folder if there is none.

The status line shows something like:

```
[my-app 12/30%p · 5h 41%]
```

`my-app` has used 12pp of its 30pp 5-hour budget, and the whole account is at 41% of the 5-hour limit.

### Settings window

`/partition:ui` opens a small window (on macOS, a native WebKit window; otherwise Chrome app mode or your browser).

- **Budget**: the whole limit as one bar, with each project's share and the unallocated part. Pick a project to see how much you can give it (100 − what other projects hold). The bar updates while you drag, and saves when you let go.
- **Rules**: when to warn, when to ask Claude to wrap up, and whether to block.
- **Connection**: whether the status line is connected, when it last ran, and buttons to connect or restore.

### Terminal

The same features work from a terminal without using tokens:

```bash
node <plugin folder>/src/cli.mjs status
```

Run it with `help` to see every command.

## How it works

1. **Status line → usage.** Claude Code runs the status line after every response and passes it `rate_limits.five_hour` and `rate_limits.seven_day` (used percentage and reset time). Hooks do not receive these values, so the status line saves them to `~/.partition/state.json`.
2. **Splitting usage between projects.** The status line also reads the new lines of the session's transcript and adds that session's tokens to its project's *pending* count. When the account percentage goes up, the increase is split between projects by their pending tokens.
3. **Stages.** For each project and each window:
   - at **80%** of the budget, you get a warning (once per window)
   - **3pp** before the budget, Claude is asked to wrap up the current task
   - at the budget, new requests and tool calls are blocked (you can turn blocking off)
4. **Partition's own commands are never blocked.**

### How the split is counted, and its limits

- Tokens are weighted by API price ratios: input 1, cache write 1.25, cache read 0.1, output 5. **This is an assumption**, not something Anthropic publishes about how limits are counted. You can change the weights in `~/.partition/config.json`.
- A percentage that goes up with no pending tokens (Claude on the web, other devices, sessions without the status line) is shown as **unattributed**.
- Usage from before Partition started tracking is shown as **before tracking**.
- With several sessions running at once, the split can lean toward one of them.
- Subagents that write to separate transcript files are not counted per project.
- The first time Partition sees a transcript, it counts only the last 10 minutes.

## Settings and data

Everything stays on your computer in `~/.partition/`. Nothing is sent anywhere.

| File | Contents |
| --- | --- |
| `config.json` | Budgets, rules, token weights, language |
| `state.json` | Usage per window and project, transcript read positions |
| `install.json` | Current plugin path, your original status line |
| `statusline.mjs` | The launcher registered in `settings.json` |

`config.json` example:

```json
{
  "budgets": { "/Users/me/projects/my-app": { "fiveHour": 30, "sevenDay": 20 } },
  "rules": { "warnAt": 0.8, "wrapMarginPp": 3, "block": true },
  "weights": { "input": 1, "cacheWrite": 1.25, "cacheRead": 0.1, "output": 5 },
  "language": "auto"
}
```

## Uninstall

1. Open `/partition:ui` → **Connection** → **Restore**. This puts your original status line back in `settings.json`.
2. `/plugin uninstall partition@partition`
3. Optionally delete `~/.partition/`.

## Development

```bash
npm install          # dev only: TypeScript for type checking
npm test             # node:test
npm run typecheck    # JSDoc types via jsconfig.json
claude --plugin-dir .
```

Plain JavaScript (ESM) with no runtime dependencies and no build step. The folder layout and design are in [docs/DESIGN.md](docs/DESIGN.md).

## Similar projects

- [Cuota](https://github.com/chechesa-labs/claude-code-cuota): per-folder 5-hour and weekly caps
- [claude-quota-guard](https://github.com/TakalaWang/claude-quota-guard): per-project weekly percent and dollar budgets

## License

[MIT](LICENSE)
