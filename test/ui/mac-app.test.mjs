import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { useTempHome } from '../helpers.mjs';
import { prepareMacApp, MAC_APP_ID } from '../../src/ui/mac-app.mjs';

const root = useTempHome();

test('native app is compiled with its own executable, name, icon, and valid signature, then reused', { skip: process.platform !== 'darwin' }, () => {
  const app = prepareMacApp();
  assert.equal(existsSync(app.executable), true);
  assert.equal(existsSync(app.iconPath), true);
  const info = spawnSync('plutil', ['-convert', 'json', '-o', '-', join(app.appPath, 'Contents/Info.plist')], { encoding: 'utf8' });
  assert.equal(info.status, 0, info.stderr);
  const plist = JSON.parse(info.stdout);
  assert.equal(plist.CFBundleName, 'Partition');
  assert.equal(plist.CFBundleDisplayName, 'Partition');
  assert.equal(plist.CFBundleIdentifier, MAC_APP_ID);
  assert.equal(plist.CFBundleExecutable, 'Partition');
  assert.equal(plist.CFBundleIconFile, 'Partition.icns');
  const signed = spawnSync('codesign', ['--verify', '--strict', app.appPath], { encoding: 'utf8' });
  assert.equal(signed.status, 0, signed.stderr);
  const iconset = join(root, 'Dock.iconset');
  const unpacked = spawnSync('iconutil', ['-c', 'iconset', app.iconPath, '-o', iconset], { encoding: 'utf8' });
  assert.equal(unpacked.status, 0, unpacked.stderr);
  const inspect = `ObjC.import('Cocoa'); function run(argv) {
    const bitmap = $.NSBitmapImageRep.imageRepWithData($.NSData.dataWithContentsOfFile($(argv[0])));
    return JSON.stringify({center: bitmap.colorAtXY(512, 512).alphaComponent, margin: bitmap.colorAtXY(50, 512).alphaComponent});
  }`;
  const pixels = spawnSync('osascript', ['-l', 'JavaScript', '-e', inspect, join(iconset, 'icon_512x512@2x.png')], { encoding: 'utf8' });
  assert.equal(pixels.status, 0, pixels.stderr);
  assert.deepEqual(JSON.parse(pixels.stdout), { center: 1, margin: 0 }, 'packaged artwork must be visible with a transparent Dock margin');
  assert.deepEqual(prepareMacApp(), app);
});
