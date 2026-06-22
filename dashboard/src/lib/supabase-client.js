import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || 'https://gzvrjsacjjalfrjmozjp.supabase.co'
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_cnkHuF_9mZ830Bhq_IUf8Q_3HUOzfW6'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
