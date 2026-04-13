const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://nrgasojgdittkjjdaenq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_fAhlNjD3GzLkTXIdoG-qgg_DcMsTMgc';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testConnection() {
    console.log('Testing connection to Supabase...');
    const { data, error } = await supabase
        .from('app_settings')
        .select('*');
    
    if (error) {
        console.error('Error fetching app_settings:', error);
    } else {
        console.log('Successfully fetched app_settings:', data);
    }
}

testConnection();
