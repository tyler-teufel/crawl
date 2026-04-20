import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import { env } from '../config.js';

export const corsPlugin = fp(async (fastify) => {
  await fastify.register(cors, {
    origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
});
