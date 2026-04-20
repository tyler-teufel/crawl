import { buildApp } from './app.js';
import { env } from './config.js';
import { startJobs } from './jobs/index.js';

const fastify = buildApp();

const start = async () => {
  try {
    await fastify.listen({ port: env.PORT, host: env.HOST });
    fastify.log.info(`Crawl API running on ${env.HOST}:${env.PORT}`);

    if (env.NODE_ENV !== 'test') {
      startJobs();
    }
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

const shutdown = async () => {
  fastify.log.info('Shutting down...');
  await fastify.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
