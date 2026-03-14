import { defineConfig } from "astro/config"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  site: "https://bmarshall511.github.io",
  base: "/forexflow",
  vite: {
    plugins: [tailwindcss()],
  },
})
