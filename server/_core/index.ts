import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import exportRoutes from "../exportRoutes";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { initializeSocket } from "../socket";
import { initializeCronJobs } from "../cronJobs";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // Inicializar Socket.io para tiempo real
  const io = initializeSocket(server);
  console.log('[Socket.io] Inicializado para tiempo real multiusuario');
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // Export routes
  app.use(exportRoutes);
  
  // Endpoint de versión para actualización forzada
  // MANDATORIO: Todos los usuarios siempre en la última versión
  const CURRENT_APP_VERSION = 87;
  app.get('/api/version', (req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json({
      version: CURRENT_APP_VERSION,
      displayVersion: `v2.${CURRENT_APP_VERSION}`,
      timestamp: Date.now(),
      forceUpdate: true
    });
  });
  
  // Proxy de imágenes para evitar CORS al generar PDFs
  app.get('/api/image-proxy', async (req, res) => {
    try {
      const imageUrl = req.query.url as string;
      if (!imageUrl) {
        return res.status(400).send('URL requerida');
      }
      
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return res.status(response.status).send('Error al obtener imagen');
      }
      
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const buffer = await response.arrayBuffer();
      
      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=3600');
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error('Error en proxy de imagen:', error);
      res.status(500).send('Error interno');
    }
  });
  
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    
    // Inicializar cron jobs para notificaciones programadas
    initializeCronJobs();
  });
}

startServer().catch(console.error);
