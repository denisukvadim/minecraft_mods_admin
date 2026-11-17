/**
 * Runtime settings for the admin panel.
 *
 * `apiBaseUrl` is relative on purpose: the dev server proxies `/api` to the
 * backend (see `proxy.conf.json`), and a production build is expected to sit
 * behind the same origin (nginx, Traefik). If you serve `dist/` from a
 * different origin, set an absolute URL here and rebuild — the backend allows
 * cross-origin requests (`CORS_ORIGINS`).
 */
export const environment = {
  apiBaseUrl: '/api/v1',
};
