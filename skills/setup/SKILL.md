---
name: setup
description: Connect Partition's status line so it can count usage. Shows the settings.json change first and applies it only after the user approves. Use when the user runs /partition:setup or asks to set up or connect Partition.
allowed-tools: Bash(node:*)
---

1. Run `node "${CLAUDE_PLUGIN_ROOT}/src/cli.mjs" setup --plan` and show the user the output as is.
2. Ask the user to approve the change. Do not apply it without a clear yes.
3. On approval, run `node "${CLAUDE_PLUGIN_ROOT}/src/cli.mjs" setup --apply` and tell the user the result in one line.
4. Tell the user (one line): undo any time with `node "${CLAUDE_PLUGIN_ROOT}/src/cli.mjs" uninstall --apply`.
