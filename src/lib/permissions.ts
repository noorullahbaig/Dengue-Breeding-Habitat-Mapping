export type PermissionQueryState = 'granted' | 'prompt' | 'denied' | 'unsupported'

/**
 * Silently queries the browser Permissions API without triggering any native prompt.
 *
 * Returns 'unsupported' when:
 *  - navigator.permissions is unavailable (very old browsers)
 *  - The browser throws for the requested permission name (Firefox throws TypeError
 *    for 'camera' / 'microphone' — they are not part of the baseline Permissions spec)
 *
 * Callers that receive 'unsupported' should fall through to calling the real API
 * (getUserMedia / getCurrentPosition) directly and interpreting the resulting error.
 */
export async function queryPermissionState(
  name: 'geolocation' | 'camera',
): Promise<PermissionQueryState> {
  if (!navigator.permissions) return 'unsupported'
  try {
    const status = await navigator.permissions.query({ name: name as PermissionName })
    return status.state as PermissionQueryState
  } catch {
    // Firefox (pre-132) throws TypeError for 'camera'. Treat as unsupported.
    return 'unsupported'
  }
}

/**
 * Subscribes to permission state changes for a given permission name.
 * Calls the callback immediately with the current state, then again on any change.
 * Returns a cleanup function.
 *
 * Note: Also listens on `visibilitychange` so we auto-detect when a user returns
 * from the OS/browser settings panel after enabling a previously denied permission.
 */
export function watchPermissionState(
  name: 'geolocation' | 'camera',
  callback: (state: PermissionQueryState) => void,
): () => void {
  let permissionStatus: PermissionStatus | null = null
  let destroyed = false

  async function init() {
    const initialState = await queryPermissionState(name)
    if (destroyed) return
    callback(initialState)

    if (!navigator.permissions) return
    try {
      permissionStatus = await navigator.permissions.query({ name: name as PermissionName })
      if (destroyed) return

      const onChange = () => {
        if (!destroyed && permissionStatus) {
          callback(permissionStatus.state as PermissionQueryState)
        }
      }
      permissionStatus.addEventListener('change', onChange)
    } catch {
      // Browser doesn't support querying this permission name — skip watcher
    }
  }

  // Also re-check when the user returns to this tab (e.g. after fixing settings)
  const onVisibilityChange = async () => {
    if (document.visibilityState === 'visible') {
      const state = await queryPermissionState(name)
      if (!destroyed) callback(state)
    }
  }
  document.addEventListener('visibilitychange', onVisibilityChange)

  void init()

  return () => {
    destroyed = true
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}
