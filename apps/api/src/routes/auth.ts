import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { buildOAuthUrl, exchangeCodeForToken, fetchGitHubUser } from '../services/github/oauth';
import { encryptToken } from '../lib/crypto';
import { db } from '../db/client';
import { users } from '../db/schema';
import { getUserProfile, saveGeminiApiKey } from '../services/UserService';
import { requireAuth } from '../lib/auth';
import { eq } from 'drizzle-orm';

// Note: session type augmentation is declared in src/types/session.d.ts
// and picked up automatically by TypeScript via tsconfig.json includes.

const authRoutes: FastifyPluginAsync = async (fastify) => {

  /**
   * GET /auth/github
   * Initiates GitHub OAuth flow. Redirects to GitHub authorization page.
   */
  fastify.get('/auth/github', {
    config: {
      rateLimit: {
        max:        10,
        timeWindow: 60_000,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    // Generate CSRF state token — stored in session, verified on callback
    const state = crypto.randomBytes(16).toString('hex');
    req.session.oauthState = state;
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
  }>('/auth/github/callback', {
    config: {
      rateLimit: {
        max:        30,       // loose — GitHub retries legitimate callbacks
        timeWindow: 60_000,
      },
    },
  }, async (req, reply) => {
    const { code, state, error } = req.query;

    // User denied OAuth
    if (error) {
      return reply.redirect(`${process.env.FRONTEND_URL}/?auth_error=denied`);
    }

    // CSRF state validation
    const storedState = req.session.oauthState;
    if (!state || !storedState) {
      return reply.status(400).send({ error: 'Invalid OAuth state — possible CSRF attack' });
    }
    const a = Buffer.from(state);
    const b = Buffer.from(storedState);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
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
          githubId:     ghUser.id,
          username:     ghUser.login,
          displayName:  ghUser.name,
          avatarUrl:    ghUser.avatar_url,
          email:        ghUser.email,
          accessToken:  encryptedToken,
          tokenScope:   tokenData.scope,
          lastActiveAt: new Date(),
        })
        .onConflictDoUpdate({
          target: users.githubId,
          set: {
            username:     ghUser.login,
            displayName:  ghUser.name,
            avatarUrl:    ghUser.avatar_url,
            email:        ghUser.email,
            accessToken:  encryptedToken,
            tokenScope:   tokenData.scope,
            updatedAt:    new Date(),
            lastActiveAt: new Date(),
          },
        })
        .returning({ id: users.id });

      // Establish authenticated session
      await req.session.regenerate();
      req.session.userId = user!.id;
      req.session.oauthState = undefined; // clear state
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
   * Returns the authenticated user's PUBLIC profile data via UserService.
   * NEVER returns: accessToken, email (unless user has made it public)
   */
  fastify.get('/auth/me', async (req, reply) => {
    const userId = req.session.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const user = await getUserProfile(userId);

    if (!user) {
      return reply.status(401).send({ error: 'User not found' });
    }

    return reply.send({ user });
  });

  /**
   * POST /auth/cinematic-seen
   * Marks that the user has seen the cinematic intro.
   */
  fastify.post('/auth/cinematic-seen', { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.session.userId!;
    await db
      .update(users)
      .set({ hasSeenCinematic: true })
      .where(eq(users.id, userId));
    return reply.send({ ok: true });
  });

  /**
   * POST /auth/gemini-key
   * Saves the user's personal Google AI Studio API key.
   */
  fastify.post<{ Body: { apiKey: string } }>('/auth/gemini-key', { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.session.userId!;
    const { apiKey } = req.body;
    
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      return reply.status(400).send({ error: 'Valid API key is required' });
    }

    // A basic check to ensure it looks like a Gemini key (starts with AIza)
    if (!apiKey.trim().startsWith('AIza') && !apiKey.trim().startsWith('AQ.')) {
       return reply.status(400).send({ error: 'Invalid API key format' });
    }

    await saveGeminiApiKey(userId, apiKey.trim());
    return reply.send({ ok: true });
  });
};

export default authRoutes;
