import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// GitHub Pages serves project sites from https://<user>.github.io/<repo>/, so
// the app needs to know its base path. Override with BASE_PATH if your repo
// name differs from "EurovisionFamilyContest" (see README.md).
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH ?? '/EurovisionFamilyContest/',
})
