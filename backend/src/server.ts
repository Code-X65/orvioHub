import { buildApp } from './app.js';
import { env } from './config/env.js';
import { emailService } from './services/email.js';

async function start() {
  const app = await buildApp();

  try {
    const address = await app.listen({ port: env.PORT, host: env.HOST });
    if (app.convex) emailService.start(app.convex);
    app.log.info(`Server running at ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}. Closing server...`);
    try {
      emailService.stop();
      await app.close();
      app.log.info('Server closed successfully.');
      process.exit(0);
    } catch (err) {
      app.log.error(`Error during server shutdown: ${err}`);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
