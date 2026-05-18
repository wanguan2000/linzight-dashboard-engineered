# LinZight RWD EDC v1.0.1

Release date: 2026-05-18

## Scope

This patch corrects the GA functional-testing package so a fresh deployment starts as a clean system. It is intended for user-entered test data and Study setup through LZ System Management.

## Key Changes

- Fresh Docker/PostgreSQL startup creates only the configured LZ system administrator.
- No default Study, patient, sample, visit, omics, or test-user data is seeded.
- Login copy no longer presents Demo authentication or role-account selectors.
- Home dashboard empty states show zero records and stay connected to backend data.
- LZ System Management manages Study create/terminate/delete, Study system admins, users, and user-to-Study permissions from an empty registry.
- Password reset request and confirmation APIs are available through SMTP.

## Initial Account

- LZ system administrator email: `guan.wang@linzight.com`
- The password is read from `LINZIGHT_INITIAL_ADMIN_PASSWORD`.

## Mail Configuration

Use environment variables for SMTP. Do not commit real SMTP passwords.

- `LINZIGHT_SMTP_HOST=smtp.feishu.cn`
- `LINZIGHT_SMTP_PORT=465`
- `LINZIGHT_SMTP_SECURITY=ssl`
- `LINZIGHT_SMTP_USERNAME=rws@linzight.com`
- `LINZIGHT_SMTP_PASSWORD=<secret>`
- `LINZIGHT_SMTP_FROM=rws@linzight.com`

## Validation

- `python3 -m compileall -q backend`
- `npm run lint`
- `npm run build`
- Docker Compose clean-volume startup verified with zero Studies, one LZ administrator, and zero global patient-index rows.
