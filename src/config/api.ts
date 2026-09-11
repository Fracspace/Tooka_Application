/**
 * API identity and endpoints, in one place.
 *
 * PR-8 — why this file exists:
 *
 * `x-api-key` was hardcoded as the string literal 'Tooka@2026' in TWO axios clients
 * (authAxiosClient and tookaAxiosClient), and the socket URL in a third file. That key
 * has been rotated. The old value still works ONLY because the backend keeps it in
 * `.env` as `API_KEY_LEGACY`, where the middleware lets it through with a warning —
 * "they will start [401ing] the moment API_KEY_LEGACY is removed".
 *
 * That failure would not look like an API problem. authAxiosClient turns any 401 into
 * `DeviceEventEmitter.emit('UNAUTHORIZED')`, which AuthContext handles by logging the
 * user out. So a key removal on the server presents as *every user being signed out of
 * the app at once*, with no clue pointing at the header.
 *
 * Keeping it in one exported constant means the next rotation is a one-line change
 * that can ship over Stallion OTA instead of a store release.
 *
 * NOTE: this is a public app-identity value — it ships in every client bundle and is
 * not an access-control boundary. Auth is the Bearer JWT. It is not a secret, but a
 * stale one breaks every request.
 */
export const API_CONFIG = {
  /** REST base. */
  baseUrl: 'https://api.tooka.app/api',

  /** Socket.IO origin — note: NO /api suffix. */
  socketUrl: 'https://api.tooka.app',

  /**
   * Current key, issued during the security audit that rotated 'Tooka@2026'.
   * Unrelated to the /api-docs Swagger password, which is still Tooka@2026.
   */
  apiKey: 'iT7pSuUjBKrbvnfsrUQdkxB-FfnyGhjU',
} as const;

export default API_CONFIG;
