import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
    ],
    server: {
        port: 3000,
        open: true,
    },
    build: {
        rolldownOptions: {
            output: {
                codeSplitting: {
                    groups: [
                        {
                            name: 'vendor-react',
                            test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|redux|react-redux|@reduxjs[\\/]toolkit|scheduler)[\\/]/,
                            priority: 30,
                        },
                        {
                            name: 'vendor-antd',
                            test: /node_modules[\\/](antd|@ant-design|rc-)[\\/]/,
                            priority: 25,
                        },
                        {
                            name: 'vendor-icons',
                            test: /node_modules[\\/]@phosphor-icons[\\/]/,
                            priority: 20,
                        },
                        {
                            name: 'vendor-excel',
                            test: /node_modules[\\/]exceljs[\\/]/,
                            priority: 20,
                        },
                        {
                            name: 'vendor-realtime',
                            test: /node_modules[\\/]@microsoft[\\/]signalr[\\/]/,
                            priority: 15,
                        },
                    ],
                },
            },
        },
    },
})
