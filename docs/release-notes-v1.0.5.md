# LinZight RWD EDC v1.0.5

Release date: 2026-05-26

## Scope

`v1.0.5` is a formal GitHub release for the current controlled internal-pilot line. It consolidates the remote hotfixes made after `v1.0.4`, including patient intake, Study administration, sample/testing status, sample ID display, patient birth-date handling, and English UI translation fixes. It remains a PostgreSQL-backed controlled validation package and is not an unrestricted real-patient production clinical deployment.

## Highlights

- Patient intake now leaves disease type blank by default, requires explicit selection, and supports optional patient name and hospital number.
- Patient birth date is stored for age calculation and editing, while patient lists continue to display only derived age for privacy.
- Age display is derived from birth date using current time; new patients infer `January 1` of `current year - age` when age is entered.
- Study Registry now supports editing existing Study master data in addition to create, select, terminate, and delete.
- Sample ledger and patient queue now display backend sample IDs directly, preserving IDs such as `S0101801`.
- Patient sample-collection and multi-omics statuses are derived from actual sample and testing records, including newly configured sample types.
- Sample remaining quantity calculation remains automatic from initial amount, sent amount, and returned amount.
- English UI coverage was expanded for patient queues, sample ledger, multi-omics testing, Study names, disease types, sample types, vendors, usage summaries, and action labels.

## Operational Notes

- Formal runtime remains PostgreSQL. SQLite is only allowed for explicit isolated smoke, legacy backup, or migration tooling with `LINZIGHT_ALLOW_SQLITE_RUNTIME=1`.
- Python 3.9 deployments now require `eval_type_backport` with Pydantic 2 for modern type annotations.
- The first formal startup creates only the initial LZ system administrator; Study, patient, sample, and omics data are created or imported by users.
- Before real patient production use, the project still requires production identity, managed secrets, object storage, backup and restore drills, security sign-off, and compliance approval.
