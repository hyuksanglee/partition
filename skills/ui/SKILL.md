---
name: ui
description: Open Partition's settings window to set per-project budgets with a GUI. Use when the user runs /partition:ui.
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

Partition's hook normally handles this command without calling the model. If you are reading this, the hook did not catch it.

Run `node "${CLAUDE_PLUGIN_ROOT}/src/cli.mjs" ui --detach --project "$(pwd)"` and show the user the output as is.
