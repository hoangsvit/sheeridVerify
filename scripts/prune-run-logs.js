import { readdir, lstat, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { parseArgs } from 'node:util';
import { isMainModule, reportFatalError } from './process.js';

const DAY = 24 * 60 * 60 * 1000;
const RUN_RESULT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/i;

// Explicit opt-in deletion; never traverse subdirectories or touch task locks,
// web-jobs history, documents, or other files under the artifacts directory.
export async function pruneRunLogs({ dir = '.runs', days = 30, apply = false, now = Date.now() } = {}) {
  if (!Number.isSafeInteger(days) || days < 1 || days > 3650) throw new Error('days must be 1..3650');
  const root = resolve(dir);
  let names;
  try { names = await readdir(root); }
  catch (error) {
    if (error.code === 'ENOENT') return { scanned: 0, expired: 0, deleted: 0, dryRun: !apply };
    throw error;
  }
  // Never prune while a workflow might still be writing its run result.
  // Task locks use SHA-256 identities; a stale lock must be resolved manually.
  if (apply && names.some(name => /^[a-f0-9]{64}\\.lock$/i.test(name))) {
    throw new Error('active task lock present; stop jobs and inspect stale locks before pruning');
  }
  const before = now - days * DAY;
  let scanned = 0, expired = 0, deleted = 0;
  for (const name of names) {
    if (!RUN_RESULT.test(name)) continue;
    const path = join(root, name);
    let stat;
    try { stat = await lstat(path); }
    catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    if (!stat.isFile()) continue;
    scanned++;
    if (stat.mtimeMs >= before) continue;
    expired++;
    if (apply) {
      try { await unlink(path); deleted++; }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  return { scanned, expired, deleted, dryRun: !apply };
}

if (isMainModule(import.meta.url)) {
  const { values } = parseArgs({ options: {
    dir: { type: 'string', default: '.runs' },
    days: { type: 'string', default: '30' },
    apply: { type: 'boolean', default: false },
  } });
  const days = Number(values.days);
  pruneRunLogs({ dir: values.dir, days, apply: values.apply })
    .then(result => process.stdout.write(JSON.stringify(result, null, 2) + '\n'))
    .catch(reportFatalError);
}
