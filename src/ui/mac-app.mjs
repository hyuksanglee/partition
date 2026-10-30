// Build a real JXA application so macOS owns the Dock name and icon.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { partitionHome } from '../store/paths.mjs';

export const MAC_APP_ID = 'io.partition.settings';
const SCRIPT = fileURLToPath(new URL('./mac-window.js', import.meta.url));
const ICON = fileURLToPath(new URL('../../.claude-plugin/icon.png', import.meta.url));
const ICON_SCRIPT = fileURLToPath(new URL('./mac-icon.js', import.meta.url));
const INFO = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>${MAC_APP_ID}</string>
<key>CFBundleName</key><string>Partition</string>
<key>CFBundleDisplayName</key><string>Partition</string>
<key>CFBundleExecutable</key><string>Partition</string>
<key>CFBundleIconFile</key><string>Partition.icns</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleSignature</key><string>aplt</string>
<key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
<key>CFBundleVersion</key><string>1</string>
<key>NSHighResolutionCapable</key><true/>
<key>OSAAppletShowStartupScreen</key><false/>
<key>OSAAppletStayOpen</key><true/>
</dict></plist>`;

/** @param {string} command @param {string[]} args */
function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 5000, maxBuffer: 8192 });
  if (result.status !== 0) throw new Error(`Partition app preparation failed (${command}).`);
}

/** Compile once per source/icon version. Each build is published atomically. */
export function prepareMacApp() {
  const digest = createHash('sha256').update(INFO).update(readFileSync(SCRIPT)).update(readFileSync(ICON)).update(readFileSync(ICON_SCRIPT)).digest('hex').slice(0, 20);
  const cache = join(partitionHome(), 'native');
  const version = join(cache, digest);
  const appPath = join(version, 'Partition.app');
  const executable = join(appPath, 'Contents/MacOS/Partition');
  const iconPath = join(appPath, 'Contents/Resources/Partition.icns');
  const complete = () => [executable, iconPath, join(appPath, 'Contents/Info.plist'), join(appPath, 'Contents/Resources/Scripts/main.scpt')].every((path) => existsSync(path));
  if (complete()) return { appPath, executable, iconPath };
  mkdirSync(cache, { recursive: true, mode: 0o700 });
  const staging = mkdtempSync(join(cache, '.build-'));
  try {
    const app = join(staging, 'Partition.app');
    run('osacompile', ['-l', 'JavaScript', '-o', app, SCRIPT]);
    renameSync(join(app, 'Contents/MacOS/applet'), join(app, 'Contents/MacOS/Partition'));
    writeFileSync(join(app, 'Contents/Info.plist'), INFO);
    const iconset = join(staging, 'Partition.iconset');
    mkdirSync(iconset);
    run('osascript', ['-l', 'JavaScript', ICON_SCRIPT, ICON, join(iconset, 'icon_512x512@2x.png')]);
    run('iconutil', ['-c', 'icns', iconset, '-o', join(app, 'Contents/Resources/Partition.icns')]);
    rmSync(iconset, { recursive: true });
    run('codesign', ['--force', '--sign', '-', app]);
    if (!complete()) {
      // Concurrent completed builds win; never remove another launch's bundle.
      try { renameSync(staging, version); }
      catch (error) { if (!complete()) throw error; }
    }
    return { appPath, executable, iconPath };
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}
