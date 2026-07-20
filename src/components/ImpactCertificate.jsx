import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "./ImpactCertificate.css";

export default function ImpactCertificate({ userId, tier, username, onClose }) {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (userId) fetchSummary();
  }, [userId]);

  async function fetchSummary() {
  const { data, error } = await supabase
    .rpc("get_impact_summary", { p_user_id: userId })
    .single();
  if (error) console.error("get_impact_summary failed:", error);
  setSummary(data);
}

  const isLocked = tier !== "paid";

  return (
    <div className="ember-cert-backdrop" onClick={onClose}>
      <div className="ember-cert-card" onClick={(e) => e.stopPropagation()}>
        {isLocked ? (
          <div className="ember-cert-locked">
            <p className="ember-cert-locked-icon">🔒</p>
            <p className="ember-cert-locked-text">Impact certificates are a paid feature.</p>
            <p className="ember-cert-locked-sub">Upgrade to export and share your yearly impact summary.</p>
          </div>
        ) : summary ? (
          <div id="ember-cert-exportable" className="ember-cert-content">
            <p className="ember-cert-eyebrow">EMBER — Impact Certificate</p>
            <h2 className="ember-cert-title">{username || "This user"}'s year of discipline</h2>

            <div className="ember-cert-stats">
              <div className="ember-cert-stat">
                <span className="ember-cert-stat-value">{summary.total_checkins}</span>
                <span className="ember-cert-stat-label">check-ins</span>
              </div>
              <div className="ember-cert-stat">
                <span className="ember-cert-stat-value">{summary.longest_streak}d</span>
                <span className="ember-cert-stat-label">longest streak</span>
              </div>
              <div className="ember-cert-stat">
                <span className="ember-cert-stat-value">{summary.total_confirmed_tokens}</span>
                <span className="ember-cert-stat-label">impact tokens</span>
              </div>
            </div>

            <div className="ember-cert-impact">
              <p>🍲 {summary.meals_funded} meals funded</p>
              <p>🧥 {summary.clothing_gifted} clothing gifted</p>
              <p>📚 {summary.academic_support_funded} academic support</p>
            </div>

            <p className="ember-cert-footer">Member since {summary.member_since}</p>
          </div>
        ) : (
          <p className="ember-cert-loading">Loading your impact...</p>
        )}

        {!isLocked && summary && (
          <button className="ember-cert-share" onClick={() => window.print()}>
            Save / Share
          </button>
        )}
        <button className="ember-cert-close" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}