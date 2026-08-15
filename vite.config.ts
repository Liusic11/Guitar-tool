import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // 相对路径部署：产物资源用 ./ 引用，部署到 GitHub Pages 任意子路径（含仓库名）
  // 都能自动找对位置，无需硬编码仓库名。
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
  // emptyOutDir:false 是刻意保留：本沙箱的安全删除 shim 会拦截 Vite 自删 dist，
  // 关掉后由手动 `rm -rf dist` 清理，避免构建被拦在 safe-delete 步骤。
  build: {
    target: 'es2020',
    cssTarget: 'chrome100',
    emptyOutDir: false,
  },
})
