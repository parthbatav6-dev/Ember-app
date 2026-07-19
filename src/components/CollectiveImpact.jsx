import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "./CollectiveImpact.css";

const TIERS = [
  { key: "meals_funded", label: "meals funded", tokens: 100 },
  { key: "clothing_gifted", label: "clothing gifted", tokens: 200 },
  { key: "academic_support_funded", label: "academic support", tokens: 500 },
];

export default function CollectiveImpact() {
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
        {TIERS.map((tier) => {
          const count = impact[tier.key] || 0;
          const tokensTowardNext = tokens % tier.tokens;
          const progressPct = Math.round((tokensTowardNext / tier.tokens) * 100);

          return (
            <div key={tier.key} className="ember-impact-tier">
              <p className="ember-impact-tier-value">
                {count} <span className="ember-impact-tier-label">{tier.label}</span>
              </p>
              <div className="ember-impact-bar-track">
                <div className="ember-impact-bar-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <p className="ember-impact-progress-text">
                {tokensTowardNext} of {tier.tokens} tokens
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}