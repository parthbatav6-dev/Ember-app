import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "./NorthStar.css";

const IDENTITY_PROMPTS = [
  "Someone who shows up, even on hard days",
  "Someone disciplined",
  "Someone healthy and strong",
  "Someone calm under pressure",
  "Someone who finishes what they start",
];

export default function NorthStar({ userId, currentValue, onClose }) {
  const [identity, setIdentity] = useState(currentValue || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (identity.trim().length === 0) return;
    setSaving(true);

    await supabase
      .from("profiles")
      .update({ north_star: identity.trim() })
      .eq("id", userId);

    setSaving(false);
    onClose();
  }

  return (
    <div className="ember-northstar-backdrop">
      <div className="ember-northstar-card">
        <p className="ember-northstar-eyebrow">Before you begin</p>
        <h2 className="ember-northstar-title">Who do you want to become?</h2>
        <p className="ember-northstar-body">
          Not what you want to achieve — who you want to be. Every habit you keep here is a vote toward that person.
        </p>

        <input
          type="text"
          className="ember-northstar-input"
          value={identity}
          onChange={(e) => setIdentity(e.target.value)}
          placeholder="I am someone who..."
          autoFocus
        />

        <div className="ember-northstar-suggestions">
          {IDENTITY_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              className="ember-northstar-chip"
              onClick={() => setIdentity(p)}
            >
              {p}
            </button>
          ))}
        </div>

        <button
          className="ember-northstar-save"
          onClick={handleSave}
          disabled={saving || identity.trim().length === 0}
        >
          {saving ? "Saving..." : "This is who I'm becoming"}
        </button>

        <button className="ember-northstar-skip" onClick={onClose}>
          Skip for now
        </button>
      </div>
    </div>
  );
}