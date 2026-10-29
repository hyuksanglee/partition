---
name: budget
description: Set this project's budget in %p, for example 30 or 30 --week. Use when the user runs /partition:budget.
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

Partition's hook normally handles this command without calling the model. If you are reading this, the hook did not catch it.

Run `node "${CLAUDE_PLUGIN_ROOT}/src/cli.mjs" budget $ARGUMENTS --project "$(pwd)"` and show the user the output as is.
