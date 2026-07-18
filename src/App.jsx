import { useState, useEffect } from "react";
import { supabase } from "./lib/supabaseClient"; // adjust path if your structure differs
import FirstHabitStep from "./components/FirstHabitStep";
import AuthScreen from "./components/AuthScreen";
import CheckInScreen from "./components/CheckInScreen";
import "./App.css";
import { initPush, registerPushUser } from "./lib/pushNotifications";

/**
 * EMBER — Root app shell
 * -------------------------------------------------------------
 * Routing, in order, for a signed-out visitor:
 *   1. FirstHabitStep — pick a habit, nothing saved yet (draftHabit)
 *   2. AuthScreen — shown with draftHabit attached; "Continue" not
 *      "Sign up", since the account is finishing something already
 *      started (IKEA/Endowment effect)
 *   3. On successful signup, the draft habit is created for real
 *      via createDraftHabit(), then draftHabit is cleared
 *
 * A returning user (existing session) skips straight to
 * CheckInScreen — FirstHabitStep only ever applies to first-time
 * visitors with no session and no draft in progress.
 * -------------------------------------------------------------
 */

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [draftHabit, setDraftHabit] = useState(null);

  useEffect(() => {
    initPush();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      registerPushUser(session.user.id);
    }
  }, [session]);

  // Once signup succeeds, if a draft habit was in progress, create
  // it for real now — this is the moment "building" becomes "saved".
  async function handleAuthSuccess(newSession) {
    setSession(newSession);

    if (draftHabit && newSession?.user?.id) {
      await supabase.from("habits").insert({
        user_id: newSession.user.id,
        name: draftHabit.name,
        icon: draftHabit.icon,
        frequency: draftHabit.frequency,
        is_active: true,
      });
      setDraftHabit(null);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <div className="ember-app-loading">
        <span className="ember-app-loading-dot" />
      </div>
    );
  }

  if (!session) {
    if (!draftHabit) {
      return <FirstHabitStep onContinue={setDraftHabit} />;
    }
    return (
      <AuthScreen onAuthSuccess={handleAuthSuccess} draftHabit={draftHabit} />
    );
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