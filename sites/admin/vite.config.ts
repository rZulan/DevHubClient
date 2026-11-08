import {defineConfig} from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
    root: import.meta.dirname,
    plugins: [react()],
    server: {
        host: "localhost",
        port: 5174,
        strictPort: true,
        proxy: {
            "/api": {target: "https://localhost:7116", secure: false},
        },
    },
})
