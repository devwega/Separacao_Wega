import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { createApiApp } from "./app.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = createApiApp();
  const server = createServer(app);

  // Serve static files from dist/public in production
  if (process.env.NODE_ENV === "production") {
    const staticPath = path.resolve(__dirname, "public");
    app.use(express.static(staticPath));

    // Handle client-side routing - serve index.html for all NON-API routes
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/")) return next();
      res.sendFile(path.join(staticPath, "index.html"));
    });
  }

  const port = Number(process.env.PORT) || 3001;

  server.listen(port, () => {
    console.log(`API server running on http://localhost:${port}/`);
    console.log(`  GET  /api/health`);
    console.log(`  GET  /api/pedidos`);
    console.log(`  GET  /api/pedidos/:nunota`);
    console.log(`  GET  /api/divergencias`);
    console.log(`  GET  /api/faltas`);
    console.log(`  GET  /api/fluxo-distinto`);
    console.log(`  GET  /api/pre-faturamento/:nunota`);
  });
}

startServer().catch(console.error);
