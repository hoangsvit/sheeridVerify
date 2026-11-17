import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebJobs } from '../src/web/jobs.js';
import { webConfig } from './fixtures/web-config.js';

const verificationId = 'abababababababababababab';
const details = {
  url: 'https://my.sheerid.com/rest/v2/verification/' + verificationId,
  firstName: 'SecretFirst', lastName: 'SecretLast', birthDate: '2001-02-03',
  proxy: 'http://account:password@127.0.0.1:8123',
};

test('Job metadata survives restart without personal details or proxy credentials', async t => {
  const { configFile } = await webConfig(t);
  const directory = await mkdtemp(join(tmpdir(), 'sheerid-history-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const historyFile = join(directory, 'jobs.json');
  const first = new WebJobs({ configFile, historyFile, workflow: async () => ({ status: 'verified', code: 'SUCCESS' }) });
  await first.initialize();
  const snapshot = await first.start(details);
  await first.jobs.get(snapshot.id).done;
  await first.close();
  const raw = await readFile(historyFile, 'utf8');
  assert.match(raw, /abababababababababababab/);
  assert.doesNotMatch(raw, /SecretFirst|SecretLast|2001-02-03|account|password|saved-secret|document|example.edu/);
  const restored = new WebJobs({ configFile, historyFile });
  await restored.initialize();
  assert.equal(restored.get(verificationId).job.state, 'completed');
  assert.equal(restored.get(verificationId).job.result.status, 'verified');
  assert.equal(restored.list().running, 0);
  assert.equal(restored.get(verificationId).events.length, 0);
  await restored.close();
});

test('After process interruption, previously running jobs are not automatically submitted again', async t => {
  const { configFile } = await webConfig(t);
  const directory = await mkdtemp(join(tmpdir(), 'sheerid-interrupt-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const historyFile = join(directory, 'jobs.json');
  const gate = Promise.withResolvers();
  const first = new WebJobs({ configFile, historyFile,
    workflow: async () => { await gate.promise; return { status: 'pending' }; } });
  await first.initialize();
  const current = await first.start(details);
  assert.ok(['queued', 'running'].includes(current.state));
  const second = new WebJobs({ configFile, historyFile, workflow: () => { throw Error('must not replay'); } });
  await second.initialize();
  assert.equal(second.list().running, 0);
  const item = second.get(verificationId).job;
  assert.equal(item.state, 'failed');
  assert.equal(item.result.code, 'RESTART_INTERRUPTED');
  assert.equal(item.result.submissionUncertain, true);
  assert.throws(() => second.resume(verificationId), { code: 'JOB_NOT_RESUMABLE' });
  second.remove(verificationId);
  await second.close();
  gate.resolve();
  await first.jobs.get(verificationId).done;
  await first.close();
});

test('Corrupt persistence refuses startup without overwriting the file', async t => {
  const { configFile } = await webConfig(t);
  const directory = await mkdtemp(join(tmpdir(), 'sheerid-corrupt-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const historyFile = join(directory, 'jobs.json');
  await writeFile(historyFile, '{"version":1,"jobs":[');
  const jobs = new WebJobs({ configFile, historyFile });
  await assert.rejects(jobs.initialize(), { code: 'HISTORY_CORRUPT' });
  assert.equal(await readFile(historyFile, 'utf8'), '{"version":1,"jobs":[');
});
