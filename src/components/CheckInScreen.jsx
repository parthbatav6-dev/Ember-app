import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import AddHabitModal from "./AddHabitModal";
import "./CheckInScreen.css";

const MOCK_HABITS = [];

function emberStyle(streak) {
  const clamped = Math.min(streak, 60);
  const glow = 4 + (clamped / 60) * 22;
  const opacity = 0.35 + (clamped / 60) * 0.65;
  const hue = streak >= 30 ? "#F5A623" : "#EA580C";
  return {
    boxShadow: `0 0 ${glow}px ${hue}`,
    backgroundColor: hue,
    opacity,
  };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function CheckInScreen({ userId }) {
  const [habits, setHabits] = useState(MOCK_HABITS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (userId) fetchHabits();
  }, [userId]);

  async function fetchHabits() {
    setLoading(true);
    setError(null);
    const today = todayISO();

    const { data: habitRows, error: habitsErr } = await supabase
      .from("habits")
      .select("id, name, icon, current_streak, is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (habitsErr) {
      setError(habitsErr.message);
      setLoading(false);
      return;
    }

    const { data: todaysCheckins, error: checkinsErr } = await supabase
      .from("habit_checkins")
      .select("habit_id")
      .eq("user_id", userId)
      .eq("checkin_date", today);

    if (checkinsErr) {
      setError(checkinsErr.message);
      setLoading(false);
      return;
    }

    const checkedInIds = new Set((todaysCheckins || []).map((c) => c.habit_id));
    setHabits(
      (habitRows || []).map((h) => ({
        ...h,
        checkedInToday: checkedInIds.has(h.id),
      }))
    );
    setLoading(false);
  }

  async function toggleCheckIn(habit) {
    if (habit.checkedInToday) return;

    setHabits((prev) =>
      prev.map((h) =>
        h.id === habit.id
          ? { ...h, checkedInToday: true, current_streak: h.current_streak + 1 }
          : h
      )
    );

    const { error: insertErr } = await supabase.from("habit_checkins").insert({
  habit_id: habit.id,
  user_id: userId,
  checkin_date: todayISO(),
});

    if (insertErr) {
      setHabits((prev) =>
        prev.map((h) =>
          h.id === habit.id
            ? { ...h, checkedInToday: false, current_streak: h.current_streak - 1 }
            : h
        )
      );
      setError("Couldn't save that check-in. Try again.");
      return;
    }

    fetchHabits();
  }

  const doneCount = useMemo(
    () => habits.filter((h) => h.checkedInToday).length,
    [habits]
  );

  return (
    <div className="ember-screen">
      <header className="ember-header">
        <p className="ember-eyebrow">Today</p>
        <h1 className="ember-title">Keep the fire lit.</h1>
        <p className="ember-subcount">
          {doneCount} of {habits.length} done
        </p>
      </header>

      {error && <div className="ember-error">{error}</div>}

      {!loading && habits.length === 0 && (
        <div className="ember-empty">
          <p className="ember-empty-title">No habits yet.</p>
          <p className="ember-empty-copy">
            Add the first one you want to hold yourself to.
          </p>
        </div>
      )}

      <ul className="ember-list">
        {habits.map((habit) => (
          <li key={habit.id} className={`ember-row ${habit.checkedInToday ? "is-done" : ""}`}>
            <button
              className="ember-checkbox"
              onClick={() => toggleCheckIn(habit)}
              disabled={habit.checkedInToday}
              aria-label={
                habit.checkedInToday
                  ? `${habit.name} already checked in today`
                  : `Check in ${habit.name}`
              }
            >
              {habit.checkedInToday ? "✓" : ""}
            </button>

            <span className="ember-icon">{habit.icon}</span>

            <div className="ember-row-main">
              <span className="ember-name">{habit.name}</span>
              <div className="ember-streak">
                <span className="ember-dot" style={emberStyle(habit.current_streak)} />
                <span className="ember-streak-count">{habit.current_streak}d</span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {loading && <p className="ember-loading">Loading…</p>}

      <button className="ember-add-btn" onClick={() => setShowAddModal(true)}>
        + Add habit
      </button>

      {showAddModal && (
        <AddHabitModal
          userId={userId}
          onClose={() => setShowAddModal(false)}
          onCreated={(newHabit) => {
            setHabits((prev) => [
              ...prev,
              { ...newHabit, current_streak: 0, checkedInToday: false },
            ]);
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
}