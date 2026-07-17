import { useState } from "react";
import { supabase } from "../lib/supabaseClient"; // adjust path to your Supabase client
import "./AddHabitModal.css";

/**
 * EMBER — Add habit modal
 * -------------------------------------------------------------
 * - Inserts directly into the `habits` table.
 * - The DB trigger `enforce_habit_limit` blocks a 6th active habit
 *   for free-tier users — this component surfaces that error in
 *   plain language rather than the raw Postgres exception text.
 * - Icon picker kept intentionally small (8 options) — this is a
 *   discipline app, not a customization playground. Fewer choices,
 *   faster habit creation, less decision fatigue at signup.
 * - onCreated(newHabit) is called on success so the parent
 *   (CheckInScreen) can refetch or optimistically append.
 * -------------------------------------------------------------
 */

const ICONS = ["💧", "📖", "🏋️", "🧘", "🍬", "🚭", "☀️", "✍️"];
const FREQUENCIES = [
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Once a week" },
  { value: "custom", label: "Specific days" },
];
const WEEKDAYS = [
  { value: 1, label: "M" },
  { value: 2, label: "T" },
  { value: 3, label: "W" },
  { value: 4, label: "T" },
  { value: 5, label: "F" },
  { value: 6, label: "S" },
  { value: 0, label: "S" },
];

export default function AddHabitModal({ userId, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(ICONS[0]);
  const [frequency, setFrequency] = useState("daily");
  const [customDays, setCustomDays] = useState([]);
  const [reminderTime, setReminderTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function toggleDay(day) {
    setCustomDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (name.trim().length === 0) {
      setError("Give the habit a name.");
      return;
    }
    if (frequency === "custom" && customDays.length === 0) {
      setError("Pick at least one day.");
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: insertErr } = await supabase
      .from("habits")
      .insert({
        user_id: userId,
        name: name.trim(),
        icon,
        frequency,
        custom_days: frequency === "custom" ? customDays : null,
        reminder_time: reminderTime || null,
        is_active: true,
      })
      .select()
      .single();

    if (insertErr) {
      setError(mapHabitError(insertErr.message));
      setLoading(false);
      return;
    }

    setLoading(false);
    onCreated?.(data);
  }

  return (
    <div className="ember-modal-backdrop" onClick={onClose}>
      <div className="ember-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ember-modal-header">
          <h2 className="ember-modal-title">New habit</h2>
          <button
            className="ember-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="ember-modal-form">
          <div className="ember-field">
            <label htmlFor="habitName">Name</label>
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
            <label htmlFor="frequency">Frequency</label>
            <select
              id="frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
            >
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {frequency === "custom" && (
            <div className="ember-field">
              <label>Days</label>
              <div className="ember-day-grid">
                {WEEKDAYS.map((d) => (
                  <button
                    type="button"
                    key={d.value}
                    className={`ember-day-option ${
                      customDays.includes(d.value) ? "is-selected" : ""
                    }`}
                    onClick={() => toggleDay(d.value)}
                    aria-pressed={customDays.includes(d.value)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="ember-field">
            <label htmlFor="reminderTime">Reminder (optional)</label>
            <input
              id="reminderTime"
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
            />
          </div>

          {error && <p className="ember-modal-error">{error}</p>}

          <button type="submit" className="ember-modal-submit" disabled={loading}>
            {loading ? "Creating…" : "Create habit"}
          </button>
        </form>
      </div>
    </div>
  );
}

function mapHabitError(message) {
  if (message.includes("Free tier limit reached"))
    return "You've hit the free plan's 5-habit limit. Upgrade to add more.";
  return "Couldn't create that habit. Try again.";
}