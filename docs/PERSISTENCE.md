# Persistent Web job history

The Web workbench saves **status metadata only** to `.runs/web-jobs-<config-hash>.json` (one file per config path). Files use owner-only permissions (`0600`). Protect the entire `.runs/` directory because verification IDs are sensitive.

Stored: verification ID, mode, queue timestamps, stage, terminal status/error code and whether a submission may be uncertain. **Not stored:** names, date of birth, email, proxy credentials, form config, upload URLs, document bytes or session cookies. Older history entries are capped at 2,000; in-memory event logs remain session-only.

A completed/failed task remains visible after restart. Jobs that were running, queued, stopped or cancelling are marked **RESTART_INTERRUPTED** and are **not automatically resubmitted**. Check the remote verification status before deleting and recreating the task with authorized details. This also means resume after a restart is intentionally unavailable.

An unreadable or corrupt history file fails startup instead of silently overwriting evidence. To disable persistence for an embedded/test instance, pass `historyFile: null` to `new WebJobs(...)`. Use only one workbench process per history file; this JSON snapshot is not a multi-process queue or database.

## Next steps

- Add explicit retention/deletion policy and backups.
- Upgrade to a transactional database if multiple server processes and durable real-time queue scheduling are required.
- Add optional encrypted-at-rest storage for sensitive recovery inputs only after defining a key management and consent policy.
