import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  request.log.error({ err: error, url: request.url, method: request.method });

  // Zod validation errors
  if (error.validation) {
    reply.code(400).send({
      error: 'Validation Error',
      message: 'Request validation failed',
      statusCode: 400,
      details: error.validation,
    });
    return;
  }

  // HTTP errors from Fastify (e.g. 404, 401)
  if (error.statusCode) {
    reply.code(error.statusCode).send({
      error: error.name ?? 'Error',
      message: error.message,
      statusCode: error.statusCode,
    });
    return;
  }

  // Fallback 500
  reply.code(500).send({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    statusCode: 500,
  });
}
