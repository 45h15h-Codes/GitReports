import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { buildOAuthUrl, exchangeCodeForToken, fetchGitHubUser } from '../services/github/oauth';
import { encryptToken } from '../lib/crypto';
import { db } from '../db/client';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

import '../types/session';

const authRoutes: FastifyPluginAsync = async (fastify) => {

  /**
   * GET /auth/github
   * Initiates GitHub OAuth flow. Redirects to GitHub authorization page.
   */
  fastify.get('/auth/github', async (req: FastifyRequest, reply: FastifyReply) => {
    // Generate CSRF state token — stored in session, verified on callback
    const state = crypto.randomBytes(16).toString('hex');
    req.session.set('oauthState', state);
    await req.session.save();

    const redirectUrl = buildOAuthUrl(state);
    return reply.redirect(redirectUrl);
  });

  /**
   * GET /auth/github/callback
   * GitHub redirects here after user authorizes. Exchanges code → token → user → session.
   */
  fastify.get<{
    Querystring: { code?: string; state?: string; error?: string };
  }>('/auth/github/callback', async (req, reply) => {
    const { code, state, error } = req.query;

    // User denied OAuth
    if (error) {
      return reply.redirect(`${process.env.FRONTEND_URL}/?auth_error=denied`);
    }

    // CSRF state validation
    const storedState = req.session.get('oauthState');
    if (!state || !storedState || state !== storedState) {
      return reply.status(400).send({ error: 'Invalid OAuth state — possible CSRF attack' });
    }

    if (!code) {
      return reply.status(400).send({ error: 'Missing authorization code' });
    }

    try {
      // Exchange code for token — SERVER-SIDE ONLY
      const tokenData = await exchangeCodeForToken(code);

      // Fetch user profile — SERVER-SIDE ONLY
      const ghUser = await fetchGitHubUser(tokenData.access_token);

      // Encrypt token before persisting — PRD §9.3
      const encryptedToken = encryptToken(tokenData.access_token);

      // Upsert user record (create or update on re-auth)
      const [user] = await db
        .insert(users)
        .values({
          githubId:    ghUser.id,
          username:    ghUser.login,
          displayName: ghUser.name,
          avatarUrl:   ghUser.avatar_url,
          email:       ghUser.email,
          accessToken: encryptedToken,
          tokenScope:  tokenData.scope,
          lastActiveAt: new Date(),
        })
        .onConflictDoUpdate({
          target:  users.githubId,
          set: {
            username:    ghUser.login,
            displayName: ghUser.name,
            avatarUrl:   ghUser.avatar_url,
            email:       ghUser.email,
            accessToken: encryptedToken,
            tokenScope:  tokenData.scope,
            updatedAt:   new Date(),
            lastActiveAt: new Date(),
          },
        })
        .returning({ id: users.id });

      // Establish authenticated session
      req.session.set('userId', user.id);
      req.session.set('oauthState', undefined); // clear state
      await req.session.save();

      // Redirect to frontend — first report trigger happens client-side
      return reply.redirect(`${process.env.FRONTEND_URL}/dashboard`);

    } catch (err) {
      fastify.log.error({ err }, 'GitHub OAuth callback error');
      return reply.redirect(`${process.env.FRONTEND_URL}/?auth_error=server`);
    }
  });

  /**
   * POST /auth/logout
   * Destroys session. 30-day inactivity logout is handled by session TTL.
   */
  fastify.post('/auth/logout', async (req, reply) => {
    await req.session.destroy();
    return reply.status(200).send({ ok: true });
  });

  /**
   * GET /auth/me
   * Returns the authenticated user's PUBLIC profile data.
   * NEVER returns: accessToken, email (unless user has made it public)
   */
  fastify.get('/auth/me', async (req, reply) => {
    const userId = req.session.get('userId');
    if (!userId) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const [user] = await db
      .select({
        id:          users.id,
        username:    users.username,
        displayName: users.displayName,
        avatarUrl:   users.avatarUrl,
        tokenScope:  users.tokenScope,
        createdAt:   users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return reply.status(401).send({ error: 'User not found' });
    }

    return reply.send({ user });
  });
};

export default authRoutes;
