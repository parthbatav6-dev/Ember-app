import { useState, useEffect } from "react";
import { supabase } from "./lib/supabaseClient"; // adjust path if your structure differs
import AuthScreen from "./components/AuthScreen";
import CheckInScreen from "./components/CheckInScreen";
import "./App.css";
import { initPush, registerPushUser } from "./lib/pushNotifications";

/**
 * EMBER — Root app shell
 * -------------------------------------------------------------
 * Owns the single source of truth for auth session state and
 * routes between AuthScreen and CheckInScreen accordingly.
 *
 * - On mount: checks for an existing session (so refreshing the
 *   page doesn't log the user out), and initializes OneSignal.
 * - Subscribes to onAuthStateChange so login/logout/token-refresh
 *   anywhere in the app keeps this state in sync automatically.
 * - Once a session exists, registers this device with OneSignal
 *   under the user's Supabase id (registerPushUser handles both
 *   the permission prompt and OneSignal.login internally).
 * - Cleans up the subscription on unmount to avoid leaks.
 * -------------------------------------------------------------
 */

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Runs once on mount: check for an existing session + init OneSignal
  useEffect(() => {
    initPush();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Keep session state in sync with any auth change,
    // anywhere in the app (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Runs whenever session changes: register this device with OneSignal
  // once we have a real logged-in user
  useEffect(() => {
    if (session?.user?.id) {
      registerPushUser(session.user.id);
    }
  }, [session]);

  async function handleLogout() {
    await supabase.auth.signOut();
    // onAuthStateChange fires automatically and clears session state
  }

  if (loading) {
    return (
      <div className="ember-app-loading">
        <span className="ember-app-loading-dot" />
      </div>
    );
  }

  if (!session) {
    return <AuthScreen onAuthSuccess={setSession} />;
  }

  return (
    <div className="ember-app">
      <CheckInScreen userId={session.user.id} />
      <button className="ember-app-logout" onClick={handleLogout}>
        Log out
      </button>
    </div>
  );
}