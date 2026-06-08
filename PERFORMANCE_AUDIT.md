# GitReport Performance Audit

This document outlines performance bottlenecks across the GitReport platform, evaluating API interactions, database queries, background workers, and frontend React rendering.

## 1. GitHub API Calls

- **Current Bottleneck**: `fetchUserRepos` and `fetchRepoCommits` utilize a sequential `while` loop (`ghFetchAll`) to paginate through results.
- **Estimated Impact**: High. For users with numerous repositories or commits, this O(N) sequential network fetching introduces severe latency (waterfalling), directly delaying report generation.
- **Proposed Optimization**: Implement concurrent fetching using `Promise.all` for pagination when max pages are known, or switch to the GitHub GraphQL API to fetch aggregated data in fewer round-trips.
- **Expected Gain**: Reduces API latency significantly by eliminating waterfall requests, leading to much faster report aggregation.

## 2. Redis Operations

- **Current Bottleneck**: `createRedisConnection()` creates a completely new `IORedis` instance upon every invocation, rather than utilizing a connection pool or caching the connection singleton.
- **Estimated Impact**: Medium-High. Creates unnecessary TCP handshake overhead on every job or worker initialization and risks exhausting Redis max connection limits under moderate-to-high load.
- **Proposed Optimization**: Implement a global Redis connection singleton (maintaining separate singletons for BullMQ Client vs. Worker as required by BullMQ specs). 
- **Expected Gain**: Eliminates repetitive connection overhead, improves worker initialization latency, and ensures stable connection management.

## 3. Database Queries

- **Current Bottleneck**: Report generation currently executes a `DELETE` query followed by an `INSERT` query (to handle composite unique constraints) instead of an atomic upsert.
- **Estimated Impact**: Low-Medium. Dual queries increase database transaction time, introduce lock contention during concurrent report generations, and degrade write throughput.
- **Proposed Optimization**: Use an `INSERT ... ON CONFLICT DO UPDATE` (upsert) strategy native to Drizzle to handle report creation/updates atomically in a single round-trip.
- **Expected Gain**: Halves database write round-trips for report updates and enhances atomic guarantees.

## 4. Worker Throughput

- **Current Bottleneck**: The `narrativeWorker.ts` imposes a global rate limit of 5 jobs per minute (`limiter: { max: 5, duration: 60_000 }`), paired with a concurrency limit of 5.
- **Estimated Impact**: Critical. This creates a severe artificial bottleneck. During traffic spikes (e.g., 20 users generating reports), users will face multi-minute queues (up to 4 minutes) waiting for their narratives.
- **Proposed Optimization**: Transition from a global rate limit to a per-user rate limit if protecting user quotas, or upgrade the LLM API tier to allow higher concurrency. Scale worker concurrency horizontally.
- **Expected Gain**: Drastically reduces queue wait times and enables the platform to process narrative generation concurrently during traffic spikes.

## 5. Bundle Size

- **Current Bottleneck**: The React frontend (`apps/web/package.json`) imports both `gsap` and `framer-motion`, adding two heavy animation libraries to the bundle. `@phosphor-icons/react` is also included which can bloat the bundle if not aggressively tree-shaken.
- **Estimated Impact**: Medium. Unnecessarily large JavaScript bundles increase download time, parse time, and delay Time-to-Interactive (TTI), particularly on mobile devices.
- **Proposed Optimization**: Standardize on a single animation library (e.g., exclusively `framer-motion` or `gsap`). Audit icon imports to ensure tree-shaking is active, and use `LazyMotion` for Framer Motion.
- **Expected Gain**: ~30-50% reduction in vendor chunk size, lowering First Contentful Paint (FCP) and TTI.

## 6. React Rendering

- **Current Bottleneck**: Complex components (e.g., CommitCharts, InsightsPanel) are likely re-rendering unnecessarily due to missing memoization strategies (no `useMemo` or `useCallback` found in the components).
- **Estimated Impact**: Medium. Can cause UI jank and dropped frames during dashboard animations or when global state updates occur.
- **Proposed Optimization**: Introduce `useMemo` for expensive data aggregation derivatives on the frontend, and `useCallback` for event handlers passed deep into the component tree.
- **Expected Gain**: Smoother UI interactions, stable 60fps animations, and reduced CPU overhead on the client.

## 7. Network Requests

- **Current Bottleneck**: The frontend polls the `/reports/:period/status` endpoint continuously to check if the background narrative job has finished.
- **Estimated Impact**: Medium. Fixed-interval polling generates excessive HTTP traffic, spamming the server and wasting client network resources.
- **Proposed Optimization**: Replace polling with Server-Sent Events (SSE) or WebSockets to push status updates to the client. Alternatively, implement exponential backoff for the polling mechanism.
- **Expected Gain**: Eliminates empty poll requests, reducing server CPU/network load and ensuring immediate UI updates upon job completion.

## 8. Caching Opportunities

- **Current Bottleneck**: GitHub API responses (or ingestion summaries) are not cached between report generation runs. Identical requests re-trigger full data fetching.
- **Estimated Impact**: High. Wastes GitHub API rate limits and increases generation time for duplicate or repeated user requests.
- **Proposed Optimization**: Cache raw GitHub API responses or intermediate aggregation payloads in Redis with an appropriate TTL (e.g., 1 hour), using `ETag` matching or `Last-Modified` headers to avoid redundant fetching.
- **Expected Gain**: Near-instant report regeneration, preservation of GitHub API rate limits, and significant reduction in backend compute overhead.
