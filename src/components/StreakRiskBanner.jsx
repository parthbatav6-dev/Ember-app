import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "./StreakRiskBanner.css";

const MEAL_TOKENS = 100;

export default function StreakRiskBanner({ habit, userId, onDismiss }) {
  const [pendingTokens, setPendingTokens] = useState(0);

  useEffect(() => {
    fetchPending();
  }, [habit.id]);

  async function fetchPending() {
    const { data } = await supabase
      .from("impact_ledger")
      .select("tokens, signal_id, signals!inner(habit_id)")
      .eq("user_id", userId)
      .eq("status", "pending")
      .eq("signals.habit_id", habit.id);

    const total = (data || []).reduce((sum, row) => sum + row.tokens, 0);
    setPendingTokens(total);
  }

  if (pendingTokens === 0) return null;

  const fraction = (pendingTokens / MEAL_TOKENS).toFixed(1);

  return (
    <div className="ember-risk-banner">
      <p className="ember-risk-eyebrow">{habit.current_streak} day streak at risk</p>
      <p className="ember-risk-title">Don't let this one go quiet.</p>
      <p className="ember-risk-body">
        You haven't checked in "{habit.name}" today. If your streak breaks, {pendingTokens} pending tokens go with it.
      </p>

      <div className="ember-risk-card">
        <div className="ember-risk-row">
          <span>Pending tokens</span>
          <span className="ember-risk-danger">{pendingTokens} at risk</span>
        </div>
        <div className="ember-risk-row">
          <span>Would have funded</span>
          <span className="ember-risk-amber">{fraction} of a meal</span>
        </div>
      </div>

      <button className="ember-risk-cta" onClick={onDismiss}>
        Finish today's habit
      </button>
      <p className="ember-risk-safe">Your earned impact from previous days is safe either way.</p>
    </div>
  );
}