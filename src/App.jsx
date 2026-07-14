import { useState, useEffect } from "react";
import { supabase } from "./lib/supabaseClient";
import AuthScreen from "./components/AuthScreen";
import CheckInScreen from "./components/CheckInScreen";
import "./App.css";

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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