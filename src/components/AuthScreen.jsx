import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "./AuthScreen.css";

export default function AuthScreen({ onAuthSuccess }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function validate() {
    if (!email.includes("@")) return "Enter a valid email.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (mode === "signup" && displayName.trim().length === 0)
      return "Enter your name.";
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    if (mode === "signup") {
      const { data, error: signupErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName.trim() },
        },
      });

      if (signupErr) {
        setError(mapAuthError(signupErr.message));
        setLoading(false);
        return;
      }

      if (data.session) {
        onAuthSuccess?.(data.session);
      } else {
        setError(null);
        setLoading(false);
        setMode("check-email");
        return;
      }
    } else {
      const { data, error: loginErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginErr) {
        setError(mapAuthError(loginErr.message));
        setLoading(false);
        return;
      }

      onAuthSuccess?.(data.session);
    }

    setLoading(false);
  }

  if (mode === "check-email") {
    return (
      <div className="ember-auth-screen">
        <div className="ember-auth-card">
          <p className="ember-auth-eyebrow">Almost there</p>
          <h1 className="ember-auth-title">Check your inbox.</h1>
          <p className="ember-auth-copy">
            We sent a confirmation link to <strong>{email}</strong>. Confirm
            your email, then come back and log in.
          </p>
          <button
            className="ember-auth-link-btn"
            onClick={() => setMode("login")}
          >
            Back to log in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ember-auth-screen">
      <div className="ember-auth-card">
        <p className="ember-auth-eyebrow">Ember</p>
        <h1 className="ember-auth-title">
          {mode === "login" ? "Welcome back." : "Start the fire."}
        </h1>

        <form onSubmit={handleSubmit} className="ember-auth-form">
          {mode === "signup" && (
            <div className="ember-field">
              <label htmlFor="displayName">Name</label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
          )}

          <div className="ember-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div className="ember-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {error && <p className="ember-auth-error">{error}</p>}

          <button type="submit" className="ember-auth-submit" disabled={loading}>
            {loading
              ? "Please wait…"
              : mode === "login"
              ? "Log in"
              : "Create account"}
          </button>
        </form>

        <button
          className="ember-auth-toggle"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
          }}
        >
          {mode === "login"
            ? "New here? Create an account"
            : "Already have an account? Log in"}
        </button>
      </div>
    </div>
  );
}

function mapAuthError(message) {
  if (message.includes("Invalid login credentials"))
    return "That email or password isn't right.";
  if (message.includes("User already registered"))
    return "An account already exists for that email. Log in instead.";
  if (message.includes("Password should be"))
    return "Password must be at least 8 characters.";
  return "Something went wrong. Try again.";
}