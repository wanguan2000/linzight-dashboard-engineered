# LinZight RWD EDC v1.0.4

Release date: 2026-05-22

## Scope

`v1.0.4` is an internal-pilot release for controlled customer validation of real-world research workflows. It remains a PostgreSQL-backed pilot package and is not an unrestricted real-patient production clinical deployment.

## Highlights

- Study Registry and patient lists now show a backend-normalized two-digit Study Code from `01` to `99`.
- Patient numbers are backend-generated, globally unique, and read-only, from `H00010` to `H99999`.
- Sample IDs are backend-generated and read-only using `S` + Study Code + patient-number suffix + per-patient sample sequence, such as `S0508001`.
- Sample remaining quantity is calculated automatically as initial quantity minus sent sample quantity plus returned sample quantity.
- Multi-omics testing records now support filters for sample type, assay, vendor, sample usage, current status, sent date, and QC.
- Patient lists default to newest-created ordering.
- The login page restores the balanced desktop dashboard layout and fixes mobile access so account and password fields stay reachable.

## Operational Notes

- Formal runtime remains PostgreSQL. SQLite is only allowed for explicit isolated smoke, legacy backup, or migration tooling with `LINZIGHT_ALLOW_SQLITE_RUNTIME=1`.
- The first formal startup creates only the initial LZ system administrator; Study, patient, sample, and omics data are created or imported by users.
- Before real patient production use, the project still requires production identity, managed secrets, object storage, backup and restore drills, security sign-off, and compliance approval.
