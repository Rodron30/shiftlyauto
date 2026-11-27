import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get migration filename from command line argument
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('ERROR: Migration filename is required as a command line argument');
  console.error('Usage: node run_migration.js <migration-file>');
  console.error('');
  console.error('Example:');
  console.error('  node run_migration.js 0045_bcautoloan_pre_approval_applications.sql');
  console.error('');
  console.error('Available migrations:');
  const migrationsDir = path.join(__dirname, 'migrations');
  if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    files.forEach(f => console.error(`  ${f}`));
  }
  process.exit(1);
}

// Resolve migration file path from database/migrations directory
const migrationsDir = path.join(__dirname, 'migrations');
const migrationPath = path.join(migrationsDir, migrationFile);

// Validate migration file exists
if (!fs.existsSync(migrationPath)) {
  console.error(`ERROR: Migration file not found: ${migrationFile}`);
  console.error(`Expected location: ${migrationPath}`);
  console.error('');
  console.error('Available migrations:');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  files.forEach(f => console.error(`  ${f}`));
  process.exit(1);
}

// Validate migration filename is safe (prevent path traversal)
const resolvedPath = path.resolve(migrationPath);
const migrationsRoot = path.resolve(migrationsDir);
const relativePath = path.relative(migrationsRoot, resolvedPath);
if (relativePath.startsWith('..' + path.sep) || path.isAbsolute(relativePath)) {
  console.error('ERROR: Invalid migration file path (path traversal detected)');
  process.exit(1);
}

// SECURITY: Require service role key only - no anon key fallback
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required');
  console.error('Usage: SUPABASE_URL=your_url SUPABASE_SERVICE_ROLE_KEY=your_key node run_migration.js <migration-file>');
  console.error('');
  console.error('Example from repository root:');
  console.error('  SUPABASE_URL=https://your-project.supabase.co \\');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \\');
  console.error('  node database/run_migration.js 0045_bcautoloan_pre_approval_applications.sql');
  process.exit(1);
}

// Read migration SQL
let migrationSQL;
try {
  migrationSQL = fs.readFileSync(migrationPath, 'utf8');
} catch (error) {
  console.error(`ERROR: Failed to read migration file: ${migrationFile}`);
  console.error(error.message);
  process.exit(1);
}

if (!migrationSQL.trim()) {
  console.error(`ERROR: Migration file is empty: ${migrationFile}`);
  process.exit(1);
}

console.log(`=== Migration Runner ===`);
console.log(`File: ${migrationFile}`);
console.log(`Path: ${migrationPath}`);
console.log(`SQL length: ${migrationSQL.length} characters`);
console.log('');


console.log('=== Execution Plan ===');
console.log('This tool will attempt to execute the migration using the Supabase REST API.');
console.log('If successful, the migration will be applied to your database.');
console.log('');
console.log('ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â  IMPORTANT: This is a production database operation.');
console.log('   - Ensure you have a recent database backup');
console.log('   - Review the migration SQL before proceeding');
console.log('   - Consider testing in a staging environment first');
console.log('');

// Preview first 20 lines of SQL
const lines = migrationSQL.split('\n').slice(0, 20);
console.log('SQL Preview (first 20 lines):');
console.log('---');
lines.forEach((line, i) => console.log(`${i + 1}: ${line}`));
if (migrationSQL.split('\n').length > 20) {
  console.log('...');
  console.log(`(${migrationSQL.split('\n').length - 20} more lines)`);
}
console.log('---');
console.log('');

// Ask for confirmation (non-interactive mode check)
const isNonInteractive = process.env.NON_INTERACTIVE === '1' || process.env.CI === '1';

if (!isNonInteractive) {
  console.log('Press Ctrl+C to cancel, or run with NON_INTERACTIVE=1 to skip confirmation');
  console.log('Executing in 5 seconds...');

  await new Promise(resolve => setTimeout(resolve, 5000));
}

console.log('=== Executing Migration ===');

async function executeMigration() {
  try {
    // Use Supabase REST API to execute SQL
    // This is more reliable than the exec_sql RPC which may not exist
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ sql: migrationSQL }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ERROR: Migration execution failed');
      console.error(`HTTP Status: ${response.status} ${response.statusText}`);
      console.error(`Response: ${errorText}`);
      console.error('');
      console.error('=== Manual Execution Required ===');
      console.error('Please execute the migration manually in Supabase SQL Editor:');
      console.error('');
      console.error('1. Open Supabase Dashboard');
      console.error('2. Navigate to SQL Editor');
      console.error('3. Paste the SQL from:');
      console.error(`   ${migrationPath}`);
      console.error('4. Execute the SQL');
      process.exit(1);
    }

    const result = await response.json();
    console.log('ÃƒÂ¢Ã…â€œÃ¢â‚¬Å“ Migration executed successfully');
    console.log('Response:', result);
  } catch (error) {
    console.error('ERROR: Migration execution failed');
    console.error(error.message);
    console.error('');
    console.error('=== Manual Execution Required ===');
    console.error('Please execute the migration manually in Supabase SQL Editor:');
    console.error('');
    console.error('1. Open Supabase Dashboard');
    console.error('2. Navigate to SQL Editor');
    console.error('3. Paste the SQL from:');
    console.error(`   ${migrationPath}`);
    console.error('4. Execute the SQL');
    process.exit(1);
  }
}

executeMigration();
