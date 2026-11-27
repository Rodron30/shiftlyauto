# Shiftly Auto Database Migrations

This directory contains SQL migration files for the Shiftly Auto database schema.

## Migration Runner

### Usage

From the repository root:

```bash
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
node database/run_migration.js <migration-file>
```

### Example

```bash
SUPABASE_URL=https://abcdefg.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... \
node database/run_migration.js 0045_bcautoloan_pre_approval_applications.sql
```

### Security

- **Required:** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- **No anon key fallback:** The runner requires the service role key only
- **Path validation:** Only allows files from `database/migrations/` directory
- **Preview mode:** Shows SQL preview before execution
- **Confirmation:** 5-second delay (can be skipped with `NON_INTERACTIVE=1`)

### Manual Execution (Recommended)

If the REST API execution fails, the runner will provide instructions for manual execution via Supabase SQL Editor:

1. Open Supabase Dashboard
2. Navigate to SQL Editor
3. Paste the SQL from the migration file
4. Execute the SQL

## Migration Execution Order

Execute migrations in numeric order to ensure dependencies are satisfied:

```
0002_history_reports_ai.sql
0003_auth_dealerships_users.sql
0004_public_reports.sql
0005_branding_invites.sql
0006_fuel_checked_by.sql
0007_v1_hardening.sql
0008_pricing.sql
0009_trade_appraisals.sql
0010_leads.sql
0011_appraisal_v2.sql
0012_crm.sql
0013_integrations.sql
0014_saas.sql
0015_platform.sql
0016_saas_enforcement.sql
0017_invite_security.sql
0018_history_accident_claim.sql
0019_vehicle_location.sql
0020_vehicle_mileage_unit.sql
0021_notifications.sql
0022_fix_role_provisioning.sql
0023_vehicle_vin_optional.sql
0024_vehicle_currency.sql
0025_vehicle_transmission.sql
0026_vehicle_images.sql
0027_customer_role.sql
0028_customer_signup.sql
0029_customer_signup_trigger.sql
0030_fix_validation_function.sql
0031_customer_invitations.sql
0032_customer_crm_access.sql  (see note below)
0032_vehicle_appearance_title.sql  (see note below)
0033_security_policy_cleanup.sql
0034_trade_appraisals_delete_policy.sql
0035_integrations_delete_role_policy.sql
0036_remove_broad_integrations_delete_policy.sql
0037_restrict_current_dealership_id_execute.sql
0038_revoke_anon_current_dealership_id.sql
0039_integrations_scheduling.sql
0040_vehicle_condition_source.sql
0041_security_restrict_integration_reads.sql
0042_remove_broad_integrations_select_policy.sql
0043_restrict_integration_sync_log_writes.sql
0044_trusted_devices.sql
0045_bcautoloan_pre_approval_applications.sql
0046_bcautoloan_storage_bucket.sql
0047_bcautoloan_rate_limiting.sql
0048_bcautoloan_security_and_rate_limit_hardening.sql
```

## Duplicate Migration Number 0032

### Situation

Two migration files share the number `0032`:

- `0032_customer_crm_access.sql` - CRM access policies for customers table
- `0032_vehicle_appearance_title.sql` - Vehicle appearance/title fields

### Forward-Only Migration Strategy

**Both files must be preserved.** Do not rename or delete either file without verifying remote migration history.

#### Step 1: Verify Remote State

Before executing any migration, check which 0032 files have already been applied in your database:

```sql
-- Check if CRM access policies exist
SELECT policyname, tablename 
FROM pg_policies 
WHERE tablename = 'customers' 
  AND policyname LIKE '%crm%';

-- Check if vehicle appearance fields exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vehicles' 
  AND column_name IN ('exterior_color', 'interior_color', 'has_clean_title');
```

#### Step 2: Execute Based on Remote State

**Case A: Neither 0032 migration has been applied**

Execute both files in any order:

```bash
node database/run_migration.js 0032_customer_crm_access.sql
node database/run_migration.js 0032_vehicle_appearance_title.sql
```

**Case B: Only `0032_customer_crm_access.sql` has been applied**

Execute only the vehicle appearance migration:

```bash
node database/run_migration.js 0032_vehicle_appearance_title.sql
```

**Case C: Only `0032_vehicle_appearance_title.sql` has been applied**

Execute only the CRM access migration:

```bash
node database/run_migration.js 0032_customer_crm_access.sql
```

**Case D: Both 0032 migrations have been applied**

Skip both files. Continue with 0033 and subsequent migrations.

#### Step 3: Future Migration Numbering

The latest migration is 0049_atomic_vehicle_quota.sql. Use 0050 for the next new migration.

## BCAutoLoan Migrations

The following migrations are specific to the BCAutoLoan customer-facing website:

- `0045_bcautoloan_pre_approval_applications.sql` - Pre-approval applications table
- `0046_bcautoloan_storage_bucket.sql` - Supabase Storage bucket for PDFs
- `0047_bcautoloan_rate_limiting.sql` - Rate limiting table
- `0048_bcautoloan_security_and_rate_limit_hardening.sql`
Execute 0049_atomic_vehicle_quota.sql as a general Shiftly Auto migration, not as a BCAutoLoan-specific migration.

Execute these migrations only when deploying BCAutoLoan to production.

## Rollback Strategy

Migrations are designed to be idempotent where possible. However, manual rollback may be required for some schema changes.

**IMPORTANT:** Always have a recent database backup before executing migrations.

## Troubleshooting

### Migration Fails with "exec_sql does not exist"

The runner will automatically provide manual execution instructions. Follow them to execute via Supabase SQL Editor.

### Migration Fails with Permission Denied

- Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
- Ensure the key has database admin privileges
- Check that the service role has not been revoked

### Migration Fails with Constraint Violation

- Check if the migration has already been applied
- Verify database state matches expected pre-migration state
- Review migration SQL for conflicts with existing schema

## Additional Resources

- Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
- Migration documentation: (TODO: add internal wiki link)
