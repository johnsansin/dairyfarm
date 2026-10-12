# Full platform backups

Superadmins can open **Superadmin → Settings → Full platform backups** and click **Back up now**. Progress and errors appear beside the button; the operation continues if the page is closed. Completed archives appear with **Download** and **Delete** actions. Delete asks for confirmation and removes only the selected archive, never live database records or uploads. Non-superadmins receive HTTP 403 for all backup actions.

New `.tar.gz` backups contain:

- `database.dump`: a native PostgreSQL custom archive of the entire application database, including schema, data, sequences, constraints, all farms/users and photos stored as data URLs.
- `uploads/N/`: copies of local upload directories.
- `manifest.json`: file locations and SHA-256 checksums.
- `RESTORE.txt`: recovery instructions.

Default upload roots are `backend/uploads`, repository-root `uploads`, and `frontend/public/uploads` relative to the usual backend working directory. This application currently stores animal and staff photo uploads inside PostgreSQL. Extra file-storage roots can be configured with `BACKUP_UPLOAD_DIRS`, a JSON array of absolute directories. Missing explicitly configured directories or symlinks fail the backup instead of silently omitting files. External URL contents/cloud buckets are not downloaded.

The dump uses a consistent PostgreSQL snapshot. Separate file directories are copied during the job; pause external file writers for a coordinated snapshot if those directories are used. Final archives are published atomically after creation, in a private backup directory, with mode 0600. Incomplete archives do not appear in the list. One full backup can run at a time across workers using a database advisory lock; progress is held on the creating process (use a single instance/sticky routing). Database/client errors are shown without credentials. Legacy `.sql` data-only exports remain downloadable and deletable and are labeled separately.

## Configuration and persistence

`BACKUP_DIR` defaults to `backups` under the backend working directory. Docker Compose persists `/app/backups` and `/app/uploads` in named volumes. `PG_DUMP_PATH` optionally specifies the native client executable; it must be at least the database server's major version. The local deployment has a checksum-verified PostgreSQL 18 client in ignored `backend/.tools/postgres`. Docker installs PostgreSQL client and tar in the runtime image. Install the matching client if using a newer database server than the Docker image supports.

These are on-demand backups. The previous schedule form only saved settings without a scheduler; it has been replaced by functioning manual backup controls. No automatic deletion or scheduled execution is enabled.

Server `.env` secrets and PostgreSQL cluster-wide roles/tablespaces are not part of the application database backup. Preserve deployment configuration and `WHATSAPP_AUTH_KEY` separately; the latter is necessary to decrypt restored WhatsApp credentials. Archives contain private account and farm data and are accessible only to superadmins.

## Restore

Use an empty target database, a compatible PostgreSQL client, and the same application version. Extract the archive, verify its checksums, then run:

```sh
pg_restore --no-owner --no-acl --exit-on-error --dbname=TARGET_DATABASE database.dump
```

Restore each uploaded-file directory according to `manifest.json` and configure the preserved environment secrets before starting the application. There is no destructive browser restore endpoint.

## Validation

`backend/scripts/verify-backups.ts` requires explicit disposable test API/database/origin and `PG_RESTORE_PATH`. It checks non-superadmin rejection, archive creation, download, checksums, uploaded-file bytes, restoring into an empty database, embedded photo preservation, deletion and malformed filenames. `frontend/tests/backups.spec.ts` tests the visible Back up now, Download and Delete controls, plus cancel/confirm deletion. No production data is restored or deleted by these tests.

## Live verification

Deployed on 2026-10-12 at `192.168.2.213:3000`. Type checks, archive/restore integration tests and the browser create/download/delete test passed. On the live superadmin page, a full archive was created and downloaded successfully, and both Download and Delete buttons were confirmed visible. The archive was retained for the superadmin. No existing live backup or application data was deleted.
