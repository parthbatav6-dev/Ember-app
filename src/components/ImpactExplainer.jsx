import "./ImpactExplainer.css";

export default function ImpactExplainer({ onClose }) {
  return (
    <div className="ember-explainer-backdrop" onClick={onClose}>
      <div className="ember-explainer-card" onClick={(e) => e.stopPropagation()}>
        <p className="ember-explainer-eyebrow">How your discipline helps</p>
        <h2 className="ember-explainer-title">Your tokens mean something real.</h2>

        <p className="ember-explainer-body">
          Every focus session, check-in, and streak you keep earns Impact Tokens.
          These aren't just points — they're designed to fund real support for people in need, across three areas:
        </p>

        <div className="ember-explainer-tiers">
          <div className="ember-explainer-tier">
            <span className="ember-explainer-tier-icon">🍲</span>
            <div>
              <p className="ember-explainer-tier-title">Meals</p>
              <p className="ember-explainer-tier-desc">100 tokens funds a meal</p>
            </div>
          </div>
          <div className="ember-explainer-tier">
            <span className="ember-explainer-tier-icon">🧥</span>
            <div>
              <p className="ember-explainer-tier-title">Clothing</p>
              <p className="ember-explainer-tier-desc">200 tokens funds clothing support</p>
            </div>
          </div>
          <div className="ember-explainer-tier">
            <span className="ember-explainer-tier-icon">📚</span>
            <div>
              <p className="ember-explainer-tier-title">Academic support</p>
              <p className="ember-explainer-tier-desc">500 tokens funds education support</p>
            </div>
          </div>
        </div>

        <p className="ember-explainer-honest">
          Ember is building toward real, verified NGO partnerships to make this happen. We'll share exactly who we're working with — and show real proof — the moment that partnership goes live. No vague promises, just an honest build in progress.
        </p>

        <button className="ember-explainer-cta" onClick={onClose}>
          Got it — let's begin
        </button>
      </div>
    </div>
  );
}