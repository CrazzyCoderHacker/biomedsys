# BioMedGest release deployment gate

The official database is currently known to contain migrations 13 and 14 only. Do not enable frontend flags before every postflight succeeds. Run these commands from the repository root with `BIOMEDGEST_DATABASE_URL` set only in the current shell; never save the database password in Git.

## Backup and baseline

1. Create and verify a complete database backup.
2. Record the five protected counts: 100 assets, 100 risks, 44 programs, 199 document links and 162 review issues.
3. Run `verify_security_hardening_postflight.sql` to confirm the expected post-14 baseline.

## Sequential installation

For each row, run the preflight, migration and postflight before continuing:

| Stage | Read-only preflight | Transactional migration | Read-only postflight |
| --- | --- | --- | --- |
| 15 | `preflight_15_readonly.sql` | `15_corrective_workflow.sql` | `verify_corrective_workflow_postflight.sql` |
| 16 | `preflight_16_readonly.sql` | `16_operational_completion.sql` | `verify_operational_completion_postflight.sql` |
| 17 | `preflight_17_readonly.sql` | `17_training_quotes_completion.sql` | `verify_business_completion_postflight.sql` |
| 18 | `preflight_18_readonly.sql` | `18_final_integration.sql` | `verify_final_integration_postflight.sql` |

Use the same invocation for each file, replacing the path:

```powershell
psql "$env:BIOMEDGEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f .\scripts\inventory\preflight_15_readonly.sql
psql "$env:BIOMEDGEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f .\supabase\15_corrective_workflow.sql
psql "$env:BIOMEDGEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f .\scripts\inventory\verify_corrective_workflow_postflight.sql
```

Stop immediately on any non-zero exit or failed assertion. Migration 16 also requires creating the private `biomedgest-private` bucket before enabling file features. Deploy `admin-users` and `storage-admin` only after migration 18, set `ALLOWED_ORIGINS` to the exact private Vercel and local origins, and retain JWT verification from `supabase/config.toml`.

## Frontend release

Keep these variables disabled until their corresponding postflights and role tests pass:

```text
VITE_INVENTORY_ADMIN_ENABLED=true
VITE_OPERATIONAL_COMPLETION_ENABLED=false
VITE_BUSINESS_COMPLETION_ENABLED=false
```

After 15–16 and their role tests pass, enable operational completion. After 17–18, Edge Functions, Auth and Storage pass, enable business completion. Configure Vercel Deployment Protection for the private demonstration; application Auth protects data but does not make the login page private.

## Recovery

Every migration is transactional: a SQL error rolls back that migration. Do not continue to the next stage. If a postflight fails after commit, keep the frontend flags disabled, undeploy or disable the two Edge Functions, preserve the database for diagnosis, and restore the verified backup only under the owner's recovery decision. Storage deletion has compensation: metadata is restored when object removal fails.
