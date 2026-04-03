import { createClient } from "@supabase/supabase-js"
import env from "@/config/env"
const supabaseClient = createClient(env.supabase_url, env.supabase_anon_key)

export default supabaseClient