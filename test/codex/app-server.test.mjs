import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { useTempHome } from '../helpers.mjs';
import { withAppServer } from '../../src/codex/app-server.mjs';

const root = useTempHome();
const mock = join(root, 'mock-server.mjs');
writeFileSync(mock, `
import {createInterface} from 'node:readline';
createInterface({input:process.stdin}).on('line',line=>{
 const r=JSON.parse(line);
 if(r.id==null || r.method==='timeout') return;
 const out=r.method==='error'?{error:{message:'test error'}}:{result:r.method==='initialize'?{}:{echo:r.params}};
 process.stdout.write(JSON.stringify({id:r.id,...out})+'\\n');
});
`);
const command = [process.execPath, mock];

test('app-server handshake, request routing, errors, timeout, and process cleanup', async () => {
  const result = await withAppServer((rpc) => rpc('echo', { a: 1 }), { command });
  assert.deepEqual(result, { echo: { a: 1 } });
  await assert.rejects(withAppServer((rpc) => rpc('error', {}), { command }), /test error/);
  await assert.rejects(withAppServer((rpc) => rpc('timeout', {}), { command, timeoutMs: 150 }), /timed out/);
  await assert.rejects(withAppServer((rpc) => rpc('echo', {}), { command: [join(root, 'missing')] }), /Cannot start/);
});
