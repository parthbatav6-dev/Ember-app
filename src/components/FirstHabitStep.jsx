import { useState } from "react";
import "./FirstHabitStep.css";

/**
 * EMBER — First habit capture (pre-signup)
 * -------------------------------------------------------------
 * Shown before AuthScreen, not after. The user picks their first
 * habit here — name, icon, frequency — with nothing saved to any
 * account yet. This is deliberate: per the IKEA/Endowment effect,
 * letting someone build something before asking for an account
 * makes signup feel like *saving progress*, not starting cold.
 *
 * On submit, the draft habit is held in memory (not the DB) and
 * passed up to App.jsx, which shows AuthScreen next. Only after
 * signup actually succeeds does the habit get created for real —
 * see App.jsx's handleAuthSuccess.
 *
 * Props:
 *   onContinue(draftHabit): called with { name, icon, frequency }
 * -------------------------------------------------------------
 */

const ICONS = ["💧", "📖", "🏋️", "🧘", "🍬", "🚭", "☀️", "✍️"];

export default function FirstHabitStep({ onContinue }) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(ICONS[0]);
  const [frequency, setFrequency] = useState("daily");
  const [error, setError] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    if (name.trim().length === 0) {
      setError("Name the thing you want to hold yourself to.");
      return;
    }
    onContinue({ name: name.trim(), icon, frequency });
  }

  return (
    <div className="ember-firsthabit-screen">
      <div className="ember-firsthabit-card">
        <p className="ember-firsthabit-eyebrow">Ember</p>
        <h1 className="ember-firsthabit-title">
          What's the first thing you want to hold yourself to?
        </h1>
        <p className="ember-firsthabit-copy">
          Pick one. You can add more once you're in.
        </p>

        <form onSubmit={handleSubmit} className="ember-firsthabit-form">
          <div className="ember-field">
            <label htmlFor="habitName">Habit</label>
            <input
              id="habitName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cold shower"
              autoFocus
            />
          </div>

          <div className="ember-field">
            <label>Icon</label>
            <div className="ember-icon-grid">
              {ICONS.map((i) => (
                <button
                  type="button"
                  key={i}
                  className={`ember-icon-option ${icon === i ? "is-selected" : ""}`}
                  onClick={() => setIcon(i)}
                  aria-label={`Select icon ${i}`}
                  aria-pressed={icon === i}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div className="ember-field">
            <label htmlFor="frequency">How often</label>
            <select
              id="frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
            >
              <option value="daily">Every day</option>
              <option value="weekly">Once a week</option>
            </select>
          </div>

          {error && <p className="ember-firsthabit-error">{error}</p>}

          <button type="submit" className="ember-firsthabit-submit">
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}