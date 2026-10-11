import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Конфиг сборки веб-дашборда.
 *  - Читает переменные из КОРНЕВОГО .env (envDir = корень репозитория).
 *  - Публично в бандл попадают ТОЛЬКО SUPABASE_URL и SUPABASE_ANON_KEY.
 *  - service_role-ключ и GEMINI_API_KEY в браузер не попадают никогда.
 *  - @oover/shared разрешается в исходники общего пакета (без отдельной сборки).
 */
export default defineConfig(({ mode }) => {
  const repoRoot = path.resolve(__dirname, '../..');
  const env = loadEnv(mode, repoRoot, '');

  return {
    envDir: repoRoot,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@oover/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      },
    },
    define: {
      'import.meta.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL ?? ''),
      'import.meta.env.SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY ?? ''),
    },
    server: {
      port: 3000,
      host: true,
      fs: {
        allow: [repoRoot],
      },
    },
  };
});
