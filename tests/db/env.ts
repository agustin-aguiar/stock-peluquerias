import { config } from 'dotenv'

config({ path: '.env.test.local' })

for (const key of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!process.env[key]) {
    throw new Error(`Falta ${key} en .env.test.local (ver .env.test.example)`)
  }
}
