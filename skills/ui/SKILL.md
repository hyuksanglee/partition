---
name: ui
description: Open Partition's settings window to set per-project budgets with a GUI. Use when the user runs /partition:ui.
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

Partition's hook has usually run this command already and added its result to your context as "Partition already ran /partition:ui". If so, reply with only that result, unchanged, in a code block, and do not run anything.

Only if that result is not in your context, run `node "${CLAUDE_PLUGIN_ROOT}/src/cli.mjs" ui --detach --project "$(pwd)"` and show the user the output as is.
