import { PermissionsAndroid, type Permission, type PermissionStatus, type Rationale } from 'react-native';

let queue: Promise<unknown> = Promise.resolve();

/**
 * PermissionsAndroid.request, one dialog at a time.
 *
 * Android shows a single permission dialog at once. At startup the app asked
 * for notifications and location together: whichever request lost never got
 * an answer, so on a fresh install location stayed "loading" forever and Home
 * showed loaders until a restart. Every request waits for the one before it.
 */
export function requestAndroidPermission(permission: Permission, rationale?: Rationale): Promise<PermissionStatus> {
  const next = queue.then(() => PermissionsAndroid.request(permission, rationale));
  // A failed request must not block the ones after it.
  queue = next.catch(() => undefined);
  return next;
}
