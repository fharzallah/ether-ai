import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { renderPage, LANGS } from './scripts/render.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const WATCHED = ['src/template.html', 'src/i18n/fr.json', 'src/i18n/en.json'].map((f) => resolve(root, f));

// index.html et en/index.html ne portent que leur langue : le contenu vient du
// gabarit commun, rendu avant que Vite ne traite les scripts et les styles.
function i18nPages(env, isBuild) {
  return {
    name: 'ether-i18n-pages',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const lang = /<html[^>]*\blang="([a-z]{2})"/.exec(html)?.[1];
        if (!lang || !LANGS.includes(lang)) throw new Error('Page sans attribut lang reconnu.');
        return renderPage(lang, env, { isBuild });
      },
    },
    configureServer(server) {
      server.watcher.add(WATCHED);
      server.watcher.on('change', (file) => {
        if (WATCHED.includes(file)) server.ws.send({ type: 'full-reload' });
      });
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, root, 'VITE_');
  return {
    root,
    appType: 'mpa',
    plugins: [i18nPages(env, command === 'build')],
    build: {
      target: 'es2022',
      // La scène 3D (three.js) est un morceau chargé à part, plus gros que la limite par défaut.
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        input: { fr: resolve(root, 'index.html'), en: resolve(root, 'en/index.html') },
      },
    },
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
  };
});
