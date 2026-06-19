import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Two deployable apps from one codebase, selected by --mode:
//   --mode permit  → .env.permit  (permit experience, base /lagrange-parking/)
//   --mode public  → .env.public  (public/visitor experience)
// VITE_PROFILE picks the profile JSON; VITE_BASE / VITE_OUTDIR set the deploy path & output dir.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: env.VITE_BASE || '/lagrange-parking/',
    build: { outDir: env.VITE_OUTDIR || 'dist' },
    plugins: [react()],
  }
})
