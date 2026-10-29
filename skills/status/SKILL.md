---
name: status
description: Show this project's usage and budget for the 5-hour and weekly limits. Use when the user runs /partition:status.
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

Partition's hook normally handles this command without calling the model. If you are reading this, the hook did not catch it.

Run `node "${CLAUDE_PLUGIN_ROOT}/src/cli.mjs" status --project "$(pwd)"` and show the user the output as is.
