import { useState, useEffect } from "react";
import { supabase } from "./lib/supabaseClient"; // adjust path if your structure differs
import AuthScreen from "./components/AuthScreen";
import CheckInScreen from "./components/CheckInScreen";
import "./App.css";

/**
 * EMBER — Root app shell
 * -------------------------------------------------------------
 * Owns the single source of truth for auth session state and
 * routes between AuthScreen and CheckInScreen accordingly.
 *
 * - On mount: checks for an existing session (so refreshing the
 *   page doesn't log the user out).
 * - Subscribes to onAuthStateChange so login/logout/token-refresh
 *   anywhere in the app keeps this state in sync automatically.
 * - Cleans up the subscription on unmount to avoid leaks.
 * -------------------------------------------------------------
 */

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Tell OneSignal which Ember user this browser belongs to, so
  // scheduled reminders can be targeted per-person via external_id.
  // Safe to call repeatedly — OneSignal dedupes on the same ID.
  function identifyOneSignalUser(userId) {
    if (!window.OneSignalDeferred) return;
    window.OneSignalDeferred.push(async function (OneSignal) {
      try {
        await OneSignal.login(userId);
      } catch (e) {
        // Non-fatal — user may not have granted notification permission yet
      }
    });
  }

  useEffect(() => {
    // Check for an existing session on load (e.g. page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session?.user?.id) identifyOneSignalUser(session.user.id);
    });

    // Keep session state in sync with any auth change,
    // anywhere in the app (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.id) identifyOneSignalUser(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

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