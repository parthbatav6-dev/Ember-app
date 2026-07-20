import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "./AnalyticsDashboard.css";

export default function AnalyticsDashboard({ userId, tier, onClose }) {
  const [trend, setTrend] = useState([]);
  const [efficiency, setEfficiency] = useState([]);
  const [velocity, setVelocity] = useState(null);

  useEffect(() => {
    if (userId && tier === "paid") fetchAll();
  }, [userId, tier]);

  async function fetchAll() {
    const [{ data: t }, { data: e }, { data: v }] = await Promise.all([
      supabase.rpc("get_consistency_trend", { p_user_id: userId }),
      supabase.rpc("get_focus_time_efficiency", { p_user_id: userId }),
      supabase.rpc("get_streak_velocity", { p_user_id: userId }).single(),
    ]);
    setTrend(t || []);
    setEfficiency(e || []);
    setVelocity(v);
  }

  const isLocked = tier !== "paid";

  return (
    <div className="ember-analytics-backdrop" onClick={onClose}>
      <div className="ember-analytics-card" onClick={(e) => e.stopPropagation()}>
        {isLocked ? (
          <div className="ember-analytics-locked">
            <p className="ember-analytics-locked-icon">🔒</p>
            <p className="ember-analytics-locked-text">Advanced analytics is a paid feature.</p>
          </div>
        ) : (
          <>
            <p className="ember-analytics-eyebrow">Your patterns</p>
            <h2 className="ember-analytics-title">Insights</h2>

            <div className="ember-analytics-section">
              <p className="ember-analytics-label">8-week consistency</p>
              <div className="ember-analytics-trend">
                {trend.map((row) => (
                  <div key={row.week_start} className="ember-analytics-bar" style={{ height: `${row.completion_rate}%` }} />
                ))}
              </div>
            </div>

            <div className="ember-analytics-section">
              <p className="ember-analytics-label">Focus session completion by time of day</p>
              {efficiency.map((row) => (
                <div key={row.hour_block} className="ember-analytics-row">
                  <span>{row.hour_block}</span>
                  <span>{row.completed_count} done / {row.broken_count} broken</span>
                </div>
              ))}
            </div>

            {velocity && (
              <div className="ember-analytics-section">
                <p className="ember-analytics-label">Streak velocity</p>
                <p className="ember-analytics-value">{velocity.active_streaks} active streaks, averaging {velocity.avg_current_streak} days</p>
              </div>
            )}
          </>
        )}
        <button className="ember-analytics-close" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}