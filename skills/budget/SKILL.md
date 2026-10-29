---
name: budget
description: Set this project's budget in %p, for example 30 or 30 --week. Use when the user runs /partition:budget.
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

Partition's hook has usually run this command already and added its result to your context as "Partition already ran /partition:budget". If so, reply with only that result, unchanged, in a code block, and do not run anything.

Only if that result is not in your context, run `node "${CLAUDE_PLUGIN_ROOT}/src/cli.mjs" budget $ARGUMENTS --project "$(pwd)"` and show the user the output as is.
