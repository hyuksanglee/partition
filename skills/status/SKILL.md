---
name: status
description: Show this project's usage and budget for the 5-hour and weekly limits. Use when the user runs /partition:status.
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

Partition's hook has usually run this command already and added its result to your context as "Partition already ran /partition:status". If so, reply with only that result, unchanged, in a code block, and do not run anything.

Only if that result is not in your context, run `node "${CLAUDE_PLUGIN_ROOT}/src/cli.mjs" status --project "$(pwd)"` and show the user the output as is.
