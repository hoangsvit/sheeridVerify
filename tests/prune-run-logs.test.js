import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, readFile, symlink, utimes, unlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pruneRunLogs } from '../scripts/prune-run-logs.js';

const DAY = 24 * 60 * 60 * 1000;
const oldName = '11111111-2222-3333-4444-555555555555.json';
const newName = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.json';

test('Retention defaults to dry-run; only expired run-result JSON is deleted with --apply', async t => {
  const root = await mkdtemp(join(tmpdir(), 'sheerid-prune-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const now = Date.now();
  for (const filename of [oldName, newName, 'web-jobs-abcd.json', 'active.lock', 'notes.json']) {
    await writeFile(join(root, filename), 'private metadata');
  }
  const oldTime = new Date(now - 31 * DAY);
  await utimes(join(root, oldName), oldTime, oldTime);
  await utimes(join(root, 'web-jobs-abcd.json'), oldTime, oldTime);
  await utimes(join(root, 'active.lock'), oldTime, oldTime);
  await utimes(join(root, 'notes.json'), oldTime, oldTime);
  const outside = join(root, 'outside.txt');
  await writeFile(outside, 'do not touch');
  const symlinkName = '12345678-1234-1234-1234-123456789abc.json';
  await symlink(outside, join(root, symlinkName));
  assert.deepEqual(await pruneRunLogs({ dir: root, now, days: 30 }),
    { scanned: 2, expired: 1, deleted: 0, dryRun: true });
  assert.equal(await readFile(join(root, oldName), 'utf8'), 'private metadata');
  const taskLock = 'a'.repeat(64) + '.lock';
  await writeFile(join(root, taskLock), 'active task');
  await assert.rejects(pruneRunLogs({ dir: root, now, days: 30, apply: true }), /active task lock/);
  await unlink(join(root, taskLock));
  assert.deepEqual(await pruneRunLogs({ dir: root, now, days: 30, apply: true }),
    { scanned: 2, expired: 1, deleted: 1, dryRun: false });
  await assert.rejects(readFile(join(root, oldName)), { code: 'ENOENT' });
  for (const filename of [newName, 'web-jobs-abcd.json', 'active.lock', 'notes.json', symlinkName]) {
    await readFile(join(root, filename));
  }
});

test('Retention validates age and safely handles absent directory', async () => {
  await assert.rejects(pruneRunLogs({ days: 0 }), /days/);
  const result = await pruneRunLogs({ dir: join(tmpdir(), 'nonexistent-sheerid-prune-test'), days: 7 });
  assert.deepEqual(result, { scanned: 0, expired: 0, deleted: 0, dryRun: true });
});
