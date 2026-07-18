// src/lib/pushNotifications.js
//
// EMBER — Push notification setup (OneSignal)
// -------------------------------------------------------------
// Call initPush() once when the app loads (e.g. in main.jsx or
// after login in App.jsx), and call registerPushUser(userId)
// once you have a logged-in session, so OneSignal can tie the
// device to your actual Supabase user.
// -------------------------------------------------------------

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID;

export function initPush() {
  if (!ONESIGNAL_APP_ID) {
    console.warn("Missing VITE_ONESIGNAL_APP_ID — push notifications disabled.");
    return;
  }

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal) => {
    await OneSignal.init({
      appId: ONESIGNAL_APP_ID,
      // Shows a native browser prompt asking for permission.
      // We trigger this manually after login instead (see below),
      // so it doesn't fire on the login screen before signup.
      notifyButton: { enable: false },
      allowLocalhostAsSecureOrigin: true, // needed for local dev testing
    });
  });
}

// Call this after a user logs in. Links their OneSignal player_id
// to their Supabase user_id, so your backend job knows who to notify.
export async function registerPushUser(userId) {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal) => {
    const permission = await OneSignal.Notifications.requestPermission();
    if (!permission) return; // user declined — don't force it

    // Tag this device with the Supabase user id so we can target
    // notifications to a specific user from the backend later.
    await OneSignal.login(userId);
  });
}