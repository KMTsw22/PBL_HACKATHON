import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
    base: './', // Capacitor 네이티브 앱에서 asset 로딩용
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            manifest: {
                name: 'My Networking Agent',
                short_name: 'Networking',
                description: '네트워킹 명함 관리 앱',
                theme_color: '#0f172a',
                background_color: '#0f172a',
                display: 'standalone',
                icons: [
                    {
                        src: '/vite.svg',
                        sizes: '192x192',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                ],
            },
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
});
