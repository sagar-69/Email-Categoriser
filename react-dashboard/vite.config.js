import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const projectRoot = path.resolve(__dirname, '..');

function resolveFromProjectRoot(filePath) {
  if (!filePath) return '';
  return path.isAbsolute(filePath) ? filePath : path.resolve(projectRoot, filePath);
}

function getBackendTarget(mode) {
  const env = loadEnv(mode, projectRoot, '');

  if (env.VITE_API_TARGET) {
    return env.VITE_API_TARGET;
  }

  const keyPath = resolveFromProjectRoot(env.SSL_KEYFILE);
  const certPath = resolveFromProjectRoot(env.SSL_CERTFILE);
  const useHttps = Boolean(
    env.SSL_KEYFILE &&
    env.SSL_CERTFILE &&
    fs.existsSync(keyPath) &&
    fs.existsSync(certPath)
  );

  return useHttps ? 'https://127.0.0.1:8000' : 'http://127.0.0.1:8000';
}

export default defineConfig(({ mode }) => {
  const backendTarget = getBackendTarget(mode);

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false, // Allows proxying to self-signed HTTPS when enabled.
        },
      },
    },
  };
})
