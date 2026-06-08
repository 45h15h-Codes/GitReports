/**
 * Global type augmentations for @fastify/session.
 *
 * @fastify/session's .get()/.set() use keyof Fastify.Session (which extends
 * ExpressSessionData). To add custom keys, we augment the `Session` interface
 * in the `fastify` module, NOT `FastifySessionObject`.
 *
 * This file is included via tsconfig "include": ["src/**\/*"],
 * so it applies globally to all files in the project.
 */

declare module 'fastify' {
  interface Session {
    userId?:     number;
    oauthState?: string;
  }
}

export {};  // make this a module (required for declaration merging to work)
