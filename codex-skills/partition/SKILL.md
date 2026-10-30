---
name: partition
description: View or change Partition project budgets for Codex subscription usage, open its settings window, or inspect its hook connection. Use when the user asks for Partition, project quota, or a Codex project usage budget.
---

Partition keeps Codex's budgets and usage separate from Claude's. Resolve the
plugin root as two directories above this skill, then use its `src/cli.mjs`.
Always pass `--provider codex` and `--project` with the user's workspace path.

- Open settings: `node <plugin-root>/src/cli.mjs --provider codex ui --detach --project <workspace>`.
  On macOS this opens a separate native WebKit window and waits for its readiness
  acknowledgement. Show the result without opening an app browser panel. If the
  hook already opened the window, do not run the command again. Describe browser
  fallback accurately on systems without native/app windows.
- Usage: `node <plugin-root>/src/cli.mjs --provider codex status --project <workspace>`.
- Budget: `node <plugin-root>/src/cli.mjs --provider codex budget <pp> --project <workspace>`; add `--week` for weekly, `0` to remove a budget.
- Install: `codex plugin marketplace add hyuksanglee/partition`, then
  `codex plugin add partition@partition`. The plugin bundles its hooks; do not
  also install user-level hooks. Review/trust them in the settings Connection
  tab or with `/hooks` in the CLI. Installation alone does not prove execution.
- For a standalone checkout without plugin installation, `setup --plan` previews
  additions to `CODEX_HOME/hooks.json`; apply the reviewed plan with `setup --apply`.
  `uninstall --apply` removes only the standalone Partition hooks.
- Standalone desktop setup: open the settings window's Connection tab, check
  status, and let the human review the commands and approve the displayed hooks.
  The page uses the desktop's own app-server and official config APIs. Do not
  mark the consent checkbox, call the approval endpoint, or grant trust on the
  user's behalf without explicit authorization for those exact hooks.
- To show settings in the app's browser panel, run `ui --serve`, open the printed
  loopback URL in that panel, and keep the server process alive while it is used.

If context says Partition already ran a command, show its result and do not run it
again. Do not claim precise attribution or complete enforcement: token weighting
is approximate, transcript JSONL is unstable, and hosted/specialized tools or an
in-flight request can consume usage outside the supported hook boundaries.
