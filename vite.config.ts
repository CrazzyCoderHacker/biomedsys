import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const demoDefines = mode === 'demo'
    ? {
        'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_DEMO_SUPABASE_URL || ''),
        'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_DEMO_SUPABASE_ANON_KEY || ''),
        'import.meta.env.VITE_INVENTORY_ADMIN_ENABLED': JSON.stringify(
          env.VITE_DEMO_INVENTORY_ADMIN_ENABLED || 'true',
        ),
        'import.meta.env.VITE_OPERATIONAL_COMPLETION_ENABLED': JSON.stringify(
          env.VITE_DEMO_OPERATIONAL_COMPLETION_ENABLED || 'true',
        ),
        'import.meta.env.VITE_BUSINESS_COMPLETION_ENABLED': JSON.stringify(
          env.VITE_DEMO_BUSINESS_COMPLETION_ENABLED || 'true',
        ),
      }
    : undefined

  return {
    plugins: [react(), tailwindcss()],
    define: demoDefines,
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
  }
})
