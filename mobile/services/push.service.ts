// Push notification service — disabled for SDK 54 compatibility
// Enable when upgrading to SDK 55+

export async function registerPushToken(_driverId: string): Promise<string | null> {
  console.log('[Push] Disabled — SDK 54 compatibility mode');
  return null;
}

export async function unregisterPushToken(_driverId: string): Promise<void> {}

export function addNotificationListeners(
  _onReceived?: unknown,
  _onTapped?: unknown,
) {
  return () => {};
}
