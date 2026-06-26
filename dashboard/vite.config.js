import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react({
      babel: {
        presets: [
          ['@babel/preset-react', { runtime: 'automatic' }]
        ]
      }
    })
  ],
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
        '.jsx': 'jsx',
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // All node_modules → one vendor chunk (avoids circular dependency crashes)
          if (id.includes('node_modules')) {
            return 'vendor'
          }
          // UI components (non-page shared components)
          if (id.includes('/src/components/')) {
            return 'components'
          }
          // Group smaller pages together (under ~15 KB each)
          if (
            id.includes('/pages/ForgotPassword') ||
            id.includes('/pages/ResetPassword') ||
            id.includes('/pages/Privacy') ||
            id.includes('/pages/Terms') ||
            id.includes('/pages/Unsubscribes') ||
            id.includes('/pages/Notifications') ||
            id.includes('/pages/BookingPage') ||
            id.includes('/pages/EmailFinder') ||
            id.includes('/pages/Database') ||
            id.includes('/pages/Admin') ||
            id.includes('/pages/Tasks')
          ) {
            return 'pages-small'
          }
          // Mid-size pages
          if (
            id.includes('/pages/Analytics') ||
            id.includes('/pages/Onboarding') ||
            id.includes('/pages/Targeting') ||
            id.includes('/pages/Prospect') ||
            id.includes('/pages/Dashboard')
          ) {
            return 'pages-mid'
          }
          // Large pages stay separate (lazy loaded, no benefit bundling)
          // Leads, Companies, CompanyDirectory, Sequences, Settings → own chunks
        },
      },
    },
  },
})
