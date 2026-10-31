import { defineConfig } from "vite";

export default defineConfig({
  base: "/telegram-qr/",
  build: {
    rollupOptions: {
      input: {
        customer: "index.html",
        admin: "admin.html",
      },
    },
  },
});
