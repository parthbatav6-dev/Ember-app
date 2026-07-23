import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import "./ImpactCertificate.css";

export default function ImpactCertificate({ userId, tier, username, onClose }) {
  const [summary, setSummary] = useState(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isTilting, setIsTilting] = useState(false);
  const cardRef = useRef(null);

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

  // 3D tilt — plain CSS transform driven by pointer position, no animation
  // libraries. Rotation is bounded to a small range so it reads as a subtle
  // physical card tilt, not a gimmick.
  function handlePointerMove(e) {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    const px = (point.clientX - rect.left) / rect.width; // 0..1
    const py = (point.clientY - rect.top) / rect.height; // 0..1
    const maxTilt = 8; // degrees
    setTilt({
      x: (py - 0.5) * -maxTilt * 2, // vertical pointer position tilts around X axis
      y: (px - 0.5) * maxTilt * 2, // horizontal pointer position tilts around Y axis
    });
    setIsTilting(true);
  }

  function handlePointerLeave() {
    setIsTilting(false);
    setTilt({ x: 0, y: 0 });
  }

  const tiltStyle = {
    transform: `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) ${isTilting ? "scale(1.02)" : "scale(1)"}`,
    transition: isTilting ? "transform 0.05s linear" : "transform 0.4s ease",
  };

  return (
    <div className="ember-cert-backdrop" onClick={onClose}>
      <div
        ref={cardRef}
        className="ember-cert-card"
        style={tiltStyle}
        onClick={(e) => e.stopPropagation()}
        onMouseMove={handlePointerMove}
        onMouseLeave={handlePointerLeave}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerLeave}
      >
        {/* Glare overlay — follows the tilt to sell the sense of a physical, reflective card */}
        <div className="ember-cert-glare" style={{ opacity: isTilting ? 0.5 : 0 }} />

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