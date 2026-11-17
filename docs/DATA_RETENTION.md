# Retention for local run-result logs

The project writes individual workflow result JSON files under `.runs/`. They may contain verification status/error metadata and should not be kept indefinitely.

Preview files older than 30 days (read-only):
```sh
npm run history:prune -- --days 30
```

Explicitly delete only expired **UUID-named result JSON** files:
```sh
npm run history:prune -- --days 30 --apply
```

Options: `--dir /absolute/private/path`, `--days 1..3650`, `--apply`.

When any SHA-256-named task lock is present, `--apply` refuses to run; inspect potentially stale locks before retrying. The command does not recurse, and never deletes task lock files, non-UUID JSON, documents, symlinks or `web-jobs-*.json` Web job history files. Dry-run is the default. Back up data before enabling scheduled cleanup, and keep the directory private. Web job history has a separate 2,000-record cap and requires an independent record-retention policy; this utility does **not** remove it.

Run manually first and review the counts, then schedule `--apply` only if this retention period fits your privacy obligations.
