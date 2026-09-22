const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// SECURITY: Use environment variables for Supabase credentials
// The service role key should be stored in SUPABASE_SERVICE_ROLE_KEY environment variable
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY) environment variables are required');
  console.error('Usage: SUPABASE_URL=your_url SUPABASE_SERVICE_ROLE_KEY=your_key node run_migration.js');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  const migrationSQL = fs.readFileSync('./migrations/0027_customer_role.sql', 'utf8');

  const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

  if (error) {
    console.error('Migration error:', error);
    console.log('Trying direct SQL execution via REST API...');
    
    // Fallback: Execute SQL via Supabase SQL editor or direct connection
    console.log('Please run the migration manually in Supabase SQL Editor:');
    console.log(migrationSQL);
    return;
  }

  console.log('Migration executed successfully');
}

runMigration();
