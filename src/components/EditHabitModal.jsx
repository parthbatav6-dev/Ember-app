import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "./EditHabitModal.css";

/**
 * EMBER — Edit habit modal
 * -------------------------------------------------------------
 * - Updates name/icon directly on the habits table.
 * - Delete uses is_active = false (soft delete) rather than a hard
 *   DELETE — this preserves check-in history and the heatmap view
 *   (habit_heatmap_data joins on habits, so hard-deleting would
 *   orphan/break past data). Matches the is_active flag already
 *   used everywhere else (fetch, streak limit trigger).
 * - onUpdated(updatedHabit) / onDeleted(habitId) let the parent
 *   (CheckInScreen) update its local list without a full refetch.
 * -------------------------------------------------------------
 */

const ICONS = ["💧", "📖", "🏋️", "🧘", "🍬", "🚭", "☀️", "✍️"];

export default function EditHabitModal({ habit, onClose, onUpdated, onDeleted }) {
  const [name, setName] = useState(habit.name);
  const [icon, setIcon] = useState(habit.icon);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave(e) {
    e.preventDefault();
    if (name.trim().length === 0) {
      setError("Give the habit a name.");
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: updateErr } = await supabase
      .from("habits")
      .update({ name: name.trim(), icon })
      .eq("id", habit.id)
      .select()
      .single();

    if (updateErr) {
      setError("Couldn't save changes. Try again.");
      setLoading(false);
      return;
    }

    setLoading(false);
    onUpdated?.(data);
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    const { error: deleteErr } = await supabase
      .from("habits")
      .update({ is_active: false })
      .eq("id", habit.id);

    if (deleteErr) {
      setError("Couldn't delete that habit. Try again.");
      setDeleting(false);
      return;
    }

    setDeleting(false);
    onDeleted?.(habit.id);
  }

  return (
    <div className="ember-modal-backdrop" onClick={onClose}>
      <div className="ember-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ember-modal-header">
          <h2 className="ember-modal-title">Edit habit</h2>
          <button className="ember-modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {!confirmingDelete ? (
          <form onSubmit={handleSave} className="ember-modal-form">
            <div className="ember-field">
              <label htmlFor="editHabitName">Name</label>
              <input
                id="editHabitName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
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

            {error && <p className="ember-modal-error">{error}</p>}

            <button type="submit" className="ember-modal-submit" disabled={loading}>
              {loading ? "Saving…" : "Save changes"}
            </button>

            <button
              type="button"
              className="ember-modal-delete-link"
              onClick={() => setConfirmingDelete(true)}
            >
              Delete this habit
            </button>
          </form>
        ) : (
          <div className="ember-modal-form">
            <p className="ember-modal-confirm-text">
              Delete <strong>{habit.name}</strong>? Your check-in history stays
              on record, but it won't show up here anymore. This can't be
              undone from the app.
            </p>

            {error && <p className="ember-modal-error">{error}</p>}

            <button
              className="ember-modal-delete-confirm"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Yes, delete it"}
            </button>

            <button
              className="ember-modal-delete-cancel"
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}