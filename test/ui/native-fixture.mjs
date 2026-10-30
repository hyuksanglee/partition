import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const READY = `console.error('PARTITION_WINDOW_READY ' + JSON.stringify({name: 'Partition', bundleId: 'io.partition.settings', icon: true})); setInterval(() => {}, 1000);`;

/** Simulate a compiled native app; no test windows are displayed.
 * @param {string} root @param {'ready' | 'exit' | 'wrong-name'} [mode]
 */
export function nativeFixture(root, mode = 'ready') {
  const bin = mkdtempSync(join(root, 'native-tools-'));
  const source = `#!${process.execPath}\n${mode === 'exit' ? 'process.exit(1);' : mode === 'wrong-name' ? READY.replace("name: 'Partition'", "name: 'osascript'") : READY}\n`;
  const compiler = `#!${process.execPath}
const fs = require('node:fs'); const path = require('node:path');
const app = process.argv[process.argv.indexOf('-o') + 1];
fs.mkdirSync(path.join(app, 'Contents/MacOS'), {recursive: true});
fs.mkdirSync(path.join(app, 'Contents/Resources/Scripts'), {recursive: true});
fs.writeFileSync(path.join(app, 'Contents/MacOS/applet'), ${JSON.stringify(source)}, {mode: 0o755});
fs.writeFileSync(path.join(app, 'Contents/Resources/Scripts/main.scpt'), 'fixture');
`;
  writeFileSync(join(bin, 'osacompile'), compiler, { mode: 0o755 });
  writeFileSync(join(bin, 'codesign'), `#!${process.execPath}\nprocess.exit(0);\n`, { mode: 0o755 });
  return bin;
}
