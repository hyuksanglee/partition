#!/usr/bin/env node
// 터미널용 CLI. hook·GUI와 같은 commands/ 모듈을 쓴다(토큰 안 씀).
import { loadConfig } from './store/config.mjs';
import { loadState } from './store/state.mjs';
import { findProject } from './project.mjs';
import { resolveLang } from './messages.mjs';
import { status } from './commands/status.mjs';
import { budgetCommand } from './commands/budget.mjs';
import { setRules } from './commands/rules.mjs';
import { setup, setupPlanText, uninstall, uninstallPlanText } from './commands/setup.mjs';
import { openUi, openUiDetached, serveUi, startUiDetached } from './commands/ui.mjs';
import { provider } from './store/paths.mjs';

const HELP = `partition — per-project budgets for Claude and Codex usage limits

  partition status                  this project's usage and budget
  partition budget <1-100|0|off> [--week]   (0 or off = no limit)
                                    set this project's 5-hour (or weekly) budget in %p
  partition rules [--warn 80] [--margin 3] [--block on|off] [--lang auto|ko|en]
  partition ui [--detach]           open the settings window
  partition ui --serve              serve settings for an in-app browser panel
  partition setup [--plan|--apply]  connect the status line (shows the change first)
  partition uninstall [--plan|--apply]

Options: --provider claude|codex (default: claude; separate budgets and usage)
         --project <path> (default: current folder), --json`;

/**
 * @param {string[]} argv
 * @param {string} name
 */
function takeOption(argv, name) {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  const [, value] = argv.splice(i, 2);
  if (value == null || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

/** @param {string[]} argv */
function takeFlag(argv, /** @type {string} */ name) {
  const i = argv.indexOf(name);
  if (i < 0) return false;
  argv.splice(i, 1);
  return true;
}

async function main() {
  const argv = process.argv.slice(2);
  const selectedProvider = takeOption(argv, '--provider');
  if (selectedProvider != null) process.env.PARTITION_PROVIDER = selectedProvider;
  provider(); // Validate before reading/writing any state.
  const project = findProject(takeOption(argv, '--project') ?? process.cwd());
  const json = takeFlag(argv, '--json');
  const config = loadConfig();
  const lang = resolveLang(config.language);
  const [cmd, ...args] = argv;

  /** @param {string} text @param {unknown} [data] */
  const print = (text, data) => console.log(json ? JSON.stringify(data ?? { text }, null, 2) : text);

  switch (cmd) {
    case 'status': {
      const r = status(project, { config, state: loadState(), lang, nowSec: Date.now() / 1000 });
      return print(r.text, r.data);
    }
    case 'budget': {
      const r = budgetCommand(project, args, lang);
      print(r.text, r);
      if (!r.ok) process.exitCode = 1;
      return;
    }
    case 'rules': {
      const warn = takeOption(args, '--warn');
      const margin = takeOption(args, '--margin');
      const block = takeOption(args, '--block');
      const language = takeOption(args, '--lang');
      const r = setRules({
        ...(warn != null ? { warnAt: Number(warn) / 100 } : {}),
        ...(margin != null ? { wrapMarginPp: Number(margin) } : {}),
        ...(block != null ? { block: block === 'on' } : {}),
        ...(language != null ? { language: /** @type {any} */ (language) } : {}),
      });
      if (!r.ok) {
        process.exitCode = 1;
        return print(`Invalid value: ${r.error}`, r);
      }
      return print(JSON.stringify(loadConfig().rules), loadConfig().rules);
    }
    case 'ui':
      if (takeFlag(args, '--serve')) return serveUi(project);
      if (takeFlag(args, '--report-ready')) return openUi(project, { onReady: (result) => console.log(JSON.stringify(result)) });
      if (takeFlag(args, '--detach')) {
        if (provider() === 'codex') {
          const result = await startUiDetached(project);
          return print(result.mode === 'window' ? 'Partition settings window opened.' : `Partition settings opened in your browser: ${result.url}`, result);
        }
        openUiDetached(project);
        return print("Partition settings window is opening. Close the window when you're done.");
      }
      {
        const owner = takeOption(args, '--owner');
        return openUi(project, owner ? { ownerPid: Number(owner) } : {});
      }
    case 'setup':
      return print(args.includes('--apply') ? setup() : setupPlanText());
    case 'uninstall':
      return print(args.includes('--apply') ? uninstall() : uninstallPlanText());
    default:
      print(HELP);
      if (cmd && cmd !== 'help' && cmd !== '--help') process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
