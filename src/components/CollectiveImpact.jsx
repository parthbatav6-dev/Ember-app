import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "./CollectiveImpact.css";

const TIERS = [
  { key: "meals_funded", label: "meals funded", tokens: 100, premium: false, icon: "🏮", position: 20 },
  { key: "clothing_gifted", label: "clothing gifted", tokens: 200, premium: false, icon: "🧥", position: 50 },
  { key: "academic_support_funded", label: "academic support", tokens: 500, premium: true, icon: "📖", position: 80 },
];

export default function CollectiveImpact({ tier }) {
  const [impact, setImpact] = useState({
    total_confirmed_tokens: 0,
    meals_funded: 0,
    clothing_gifted: 0,
    academic_support_funded: 0,
  });

  useEffect(() => {
    fetchImpact();
  }, []);

  async function fetchImpact() {
    const { data } = await supabase
      .from("collective_impact")
      .select("total_confirmed_tokens, meals_funded, clothing_gifted, academic_support_funded")
      .single();
    if (data) setImpact(data);
  }

  const tokens = impact.total_confirmed_tokens || 0;
  // Overall scene glow intensity — how "lit" the whole valley looks, based on
  // progress toward the highest tier. Purely atmospheric, not a real metric.
  const sceneIntensity = Math.min(1, tokens / TIERS[TIERS.length - 1].tokens);

  return (
    <div className="ember-impact">
      <p className="ember-impact-label">Collective impact</p>

      <div
        className="ember-valley-scene"
        style={{ "--scene-glow": sceneIntensity }}
      >
        <div className="ember-valley-sky" />
        <div className="ember-valley-hill ember-valley-hill-back" />
        <div className="ember-valley-hill ember-valley-hill-front" />

        {TIERS.map((t) => {
          const isLocked = t.premium && tier !== "paid";
          const count = impact[t.key] || 0;
          const tokensTowardNext = tokens % t.tokens;
          const progressFraction = tokensTowardNext / t.tokens;
          const isLit = !isLocked && count > 0;

          return (
            <div
              key={t.key}
              className={`ember-valley-landmark ${isLit ? "is-lit" : ""} ${isLocked ? "is-locked" : ""}`}
              style={{ left: `${t.position}%`, "--landmark-glow": progressFraction }}
            >
              <div className="ember-valley-landmark-glow" />
              <div className="ember-valley-landmark-icon">{isLocked ? "🔒" : t.icon}</div>
              {isLit && <div className="ember-valley-landmark-badge">✓</div>}
            </div>
          );
        })}
      </div>

      <div className="ember-impact-tiers">
        {TIERS.map((t) => {
          const isLocked = t.premium && tier !== "paid";
          const count = impact[t.key] || 0;
          const tokensTowardNext = tokens % t.tokens;

          return (
            <div key={t.key} className={`ember-impact-tier ${isLocked ? "is-locked" : ""}`}>
              <p className="ember-impact-tier-value">
                {isLocked ? "🔒" : count} <span className="ember-impact-tier-label">{t.label}</span>
              </p>
              {isLocked ? (
                <p className="ember-impact-progress-text">Upgrade to unlock</p>
              ) : (
                <p className="ember-impact-progress-text">
                  {tokensTowardNext} of {t.tokens} tokens to next
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}