---
name: ui
description: Open the separate Partition settings window for Codex budgets. Use when the user enters /partition:ui or $partition:ui, or asks to open Partition settings.
---

If a Partition hook says it already opened the settings window, show its result
in the user's language without running the CLI again or opening a browser panel.
Do not grant hook trust automatically.

Otherwise resolve the plugin root two directories above this skill and run:

`node <plugin-root>/src/cli.mjs --provider codex ui --detach --project <workspace>`

On macOS this opens the same separate native WebKit window used by Claude.
The command waits for the window to confirm readiness before reporting success.
Tell the user the settings window opened; do not also open an app browser panel.
If it reports browser fallback on another system, describe that result accurately.
Report startup errors truthfully. Use `ui --serve` only when a browser page is
explicitly wanted or as a user-requested fallback.
