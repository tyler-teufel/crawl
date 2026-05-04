import { describe, it, expect, vi } from 'vitest';
import { errorHandler } from '../../src/plugins/error-handler.js';
import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';

function makeReply() {
  const reply = { code: vi.fn(), send: vi.fn() };
  reply.code.mockReturnValue(reply);
  return reply as unknown as FastifyReply;
}

const req = {
  log: { error: vi.fn() },
  url: '/test',
  method: 'GET',
} as unknown as FastifyRequest;

describe('errorHandler', () => {
  it('returns 400 with validation details when error.validation is set', () => {
    const reply = makeReply();
    const error = {
      validation: [{ message: 'field is required' }],
      message: 'Request validation failed',
    } as unknown as FastifyError;

    errorHandler(error, req, reply);

    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        details: error.validation,
      })
    );
  });

  it('passes through statusCode for known HTTP errors', () => {
    const reply = makeReply();
    const error = {
      statusCode: 403,
      name: 'Forbidden',
      message: 'Access denied',
    } as unknown as FastifyError;

    errorHandler(error, req, reply);

    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: 'Access denied',
      })
    );
  });

  it('falls back to 500 for generic errors with no statusCode or validation', () => {
    const reply = makeReply();
    const error = { message: 'Something exploded internally' } as unknown as FastifyError;

    errorHandler(error, req, reply);

    expect(reply.code).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        error: 'Internal Server Error',
      })
    );
  });
});
