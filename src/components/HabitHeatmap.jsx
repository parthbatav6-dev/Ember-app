import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import "./HabitHeatmap.css";

/**
 * EMBER — Habit heatmap detail view
 * -------------------------------------------------------------
 * Reads from the `habit_heatmap_data` VIEW (already live in your
 * Supabase project) — it pre-generates the last 365 days per habit
 * with a checked_in boolean, so no date-math needed client-side.
 *
 * Renders GitHub-style contribution squares, grouped into weeks,
 * most recent day bottom-right — same mental model people already
 * know from GitHub, so no explanation needed in the UI itself.
 * -------------------------------------------------------------
 */

function intensity(checkedIn) {
  // Binary for now (checked in / not) — matches what the view gives us.
  // If you later want multi-level intensity (e.g. partial credit),
  // the view would need a numeric value instead of boolean.
  return checkedIn ? 1 : 0;
}

export default function HabitHeatmap({ habit, userId, onClose }) {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchHeatmap();
  }, [habit.id]);

  async function fetchHeatmap() {
    setLoading(true);
    setError(null);

    const { data, error: fetchErr } = await supabase
      .from("habit_heatmap_data")
      .select("day, checked_in")
      .eq("habit_id", habit.id)
      .eq("user_id", userId)
      .order("day", { ascending: true });

    if (fetchErr) {
      setError(fetchErr.message);
      setLoading(false);
      return;
    }

    setDays(data || []);
    setLoading(false);
  }

  // Group flat day list into weeks (columns) for the grid layout
  const weeks = useMemo(() => {
    if (days.length === 0) return [];

    const result = [];
    let currentWeek = [];

    // Pad the first week so the grid aligns to Sunday-start columns
    const firstDay = new Date(days[0].day);
    const firstDayOfWeek = firstDay.getUTCDay(); // 0 = Sunday
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push(null);
    }

    days.forEach((d) => {
      currentWeek.push(d);
      if (currentWeek.length === 7) {
        result.push(currentWeek);
        currentWeek = [];
      }
    });
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(null);
      result.push(currentWeek);
    }

    return result;
  }, [days]);

  const totalCheckedIn = useMemo(
    () => days.filter((d) => d.checked_in).length,
    [days]
  );

  return (
    <div className="ember-heatmap-backdrop" onClick={onClose}>
      <div className="ember-heatmap-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ember-heatmap-header">
          <div>
            <p className="ember-heatmap-eyebrow">{habit.icon} {habit.name}</p>
            <h2 className="ember-heatmap-title">
              {totalCheckedIn} days this year
            </h2>
          </div>
          <button
            className="ember-heatmap-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {error && <p className="ember-heatmap-error">{error}</p>}

        {loading && <p className="ember-heatmap-loading">Loading…</p>}

        {!loading && !error && (
          <div className="ember-heatmap-scroll">
            <div className="ember-heatmap-grid">
              {weeks.map((week, wi) => (
                <div className="ember-heatmap-col" key={wi}>
                  {week.map((day, di) =>
                    day ? (
                      <div
                        key={di}
                        className={`ember-heatmap-cell level-${intensity(day.checked_in)}`}
                        title={`${day.day}${day.checked_in ? " — done" : ""}`}
                      />
                    ) : (
                      <div key={di} className="ember-heatmap-cell is-empty" />
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="ember-heatmap-legend">
          <span>Less</span>
          <div className="ember-heatmap-cell level-0" />
          <div className="ember-heatmap-cell level-1" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
}