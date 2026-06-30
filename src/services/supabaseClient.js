import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

// Validate environment variables - check for missing or placeholder values
const isValidEnvVar = (value) => {
  return value && value !== 'YOUR_SUPABASE_URL' && value !== 'YOUR_SUPABASE_ANON_KEY'
}

if (!isValidEnvVar(supabaseUrl) || !isValidEnvVar(supabaseAnonKey)) {
  if (typeof window === 'undefined') {
    // Server-side during build/render - show helpful error
    console.error('\n==============================================')
    console.error('❌ Missing Supabase Environment Variables')
    console.error('==============================================')
    console.error('Please update your .env.local file with actual values:')
    console.error('  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co')
    console.error('  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here')
    console.error('\nGet your credentials from: Supabase Dashboard > Settings > API')
    console.error('==============================================\n')
  }
  throw new Error('Missing Supabase environment variables. Please check your .env.local file and add real values (not placeholders).')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
