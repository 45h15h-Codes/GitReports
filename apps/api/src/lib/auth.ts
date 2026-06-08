/**
 * Authentication middleware helpers
 *
 * requireAuth: Fastify preHandler that returns 401 if the request has no
 * valid session. Attach as a preHandler on any protected route.
 *
 * Usage:
 *   fastify.get('/protected', { preHandler: requireAuth }, async (req, reply) => {
 *     const userId = req.session.get('userId')!;   // guaranteed by requireAuth
 *     // ...
 *   });
 */

import type { FastifyRequest, FastifyReply } from 'fastify';

export async function requireAuth(
  req:   FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const userId = req.session.get('userId');
  if (!userId) {
    reply.status(401).send({ error: 'Authentication required' });
  }
}
