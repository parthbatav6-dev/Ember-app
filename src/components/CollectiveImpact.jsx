import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "./CollectiveImpact.css";

const TIERS = [
  { key: "meals_funded", label: "meals funded", tokens: 100, premium: false },
  { key: "clothing_gifted", label: "clothing gifted", tokens: 200, premium: false },
  { key: "academic_support_funded", label: "academic support", tokens: 500, premium: true },
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

  return (
    <div className="ember-impact">
      <p className="ember-impact-label">Collective impact</p>

      <div className="ember-impact-tiers">
        {TIERS.map((t) => {
  const isLocked = t.premium && tier !== "premium";
  const count = impact[t.key] || 0;
  const tokensTowardNext = tokens % t.tokens;
  const progressPct = Math.round((tokensTowardNext / t.tokens) * 100);

  return (
    <div key={t.key} className={`ember-impact-tier ${isLocked ? "is-locked" : ""}`}>
      <p className="ember-impact-tier-value">
        {isLocked ? "🔒" : count} <span className="ember-impact-tier-label">{t.label}</span>
      </p>
      {isLocked ? (
        <p className="ember-impact-progress-text">Upgrade to unlock</p>
      ) : (
        <>
          <div className="ember-impact-bar-track">
            <div className="ember-impact-bar-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="ember-impact-progress-text">
            {tokensTowardNext} of {t.tokens} tokens
          </p>
        </>
      )}
    </div>
  );
})}
      </div>
    </div>
  );
}