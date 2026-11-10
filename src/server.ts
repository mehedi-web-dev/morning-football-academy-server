import { Server } from 'http';
import app from './app.js';
import { env } from './config/env.js';
import { connectDB, closeDB } from './config/db.js';

let server: Server | null = null;

async function startServer(): Promise<void> {
  try {
    // Ensure database connection is established before accepting requests
    console.log('[Server] Connecting to MongoDB Atlas before accepting requests...');
    await connectDB();

    server = app.listen(env.PORT, () => {
      console.log(`[Server] Morning Football Academy Server is running on port ${env.PORT} (${env.NODE_ENV})`);
      console.log(`[Server] Health check available at: http://localhost:${env.PORT}/api/v1/health`);
    });
  } catch (error) {
    console.error('[Server] Failed to connect to database or start server:', error);
    process.exit(1);
  }
}

async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);

  // Force shutdown after 10 seconds timeout if gracefully closing hangs
  const forceExitTimeout = setTimeout(() => {
    console.error('[Server] Graceful shutdown timed out. Forcing termination.');
    process.exit(1);
  }, 10000);
  forceExitTimeout.unref();

  if (server) {
    server.close(async (err) => {
      if (err) {
        console.error('[Server] Error while closing HTTP server:', err);
      } else {
        console.log('[Server] HTTP server closed cleanly.');
      }

      try {
        await closeDB();
      } catch (dbErr) {
        console.error('[Database] Error while closing database connection:', dbErr);
      }

      console.log('[Server] Graceful shutdown complete. Exiting.');
      process.exit(0);
    });
  } else {
    try {
      await closeDB();
    } catch (dbErr) {
      console.error('[Database] Error while closing database connection:', dbErr);
    }
    process.exit(0);
  }
}

// Graceful shutdown signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions and unhandled promise rejections
process.on('uncaughtException', (error) => {
  console.error('[Server] Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled Rejection:', reason);
  gracefulShutdown('unhandledRejection');
});

startServer();
