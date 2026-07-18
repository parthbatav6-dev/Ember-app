import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabaseClient"; // adjust path to your Supabase client
import AddHabitModal from "./AddHabitModal";
import EditHabitModal from "./EditHabitModal";
import HabitHeatmap from "./HabitHeatmap";
import WeeklyStats from "./WeeklyStats";
import WeekBar from "./WeekBar";
import FlowScore from "./FlowScore";
import "./CheckInScreen.css";

/**
 * EMBER — Check-in Screen
 * -------------------------------------------------------------
 * Wiring notes for your Supabase project (already live schema):
 *
 * - habits: id, user_id, name, icon, color, frequency, is_active,
 *           current_streak, longest_streak, last_checkin_date
 * - habit_checkins: id, habit_id, user_id, checkin_date, note, created_at
 * - A DB trigger (on_checkin_insert) already updates current_streak
 *   on habits automatically when a checkin row is inserted.
 *   -> This component does NOT recompute streaks client-side.
 *      It just inserts the checkin and re-fetches habits after.
 *
 * Replace MOCK_HABITS below with a real fetch (see fetchHabits()).
 * -------------------------------------------------------------
 */

const MOCK_HABITS = [
  { id: "1", name: "Cold shower", icon: "💧", current_streak: 12, checkedInToday: false },
  { id: "2", name: "Read 20 pages", icon: "📖", current_streak: 34, checkedInToday: true },
  { id: "3", name: "No sugar", icon: "🍬", current_streak: 3, checkedInToday: false },
  { id: "4", name: "Gym", icon: "🏋️", current_streak: 58, checkedInToday: false },
];

// Ember glow intensity scales with streak length — the signature element.
function emberStyle(streak) {
  const clamped = Math.min(streak, 60);
  const glow = 4 + (clamped / 60) * 22; // px blur radius
  const opacity = 0.35 + (clamped / 60) * 0.65;
  const hue = streak >= 30 ? "#F5A623" : "#EA580C"; // brighter gold once streak matures
  return {
    boxShadow: `0 0 ${glow}px ${hue}`,
    backgroundColor: hue,
    opacity,
  };
}

function todayISO() {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const now = new Date();
  const istNow = new Date(now.getTime() + istOffsetMs);
  return istNow.toISOString().slice(0, 10);
}

export default function CheckInScreen({ userId }) {
  const [habits, setHabits] = useState(MOCK_HABITS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [heatmapHabit, setHeatmapHabit] = useState(null);
  const [editingHabit, setEditingHabit] = useState(null);
  const [notifStatus, setNotifStatus] = useState("unknown");
  const [last7Checkins, setLast7Checkins] = useState([]); // unknown | default | granted | denied

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setNotifStatus(Notification.permission);
    }
  }, []);

  async function enableNotifications() {
    if (!window.OneSignalDeferred) return;
    window.OneSignalDeferred.push(async function (OneSignal) {
      await OneSignal.Notifications.requestPermission();
      setNotifStatus(Notification.permission);
    });
  }

  useEffect(() => {
    if (userId) fetchHabits();
  }, [userId]);

  async function fetchHabits() {
    setLoading(true);
    setError(null);
    const today = todayISO();

    const { data: habitRows, error: habitsErr } = await supabase
      .from("habits")
      .select("id, name, icon, current_streak, is_active, reminder_time")
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
    const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
const sevenDaysAgoISO = sevenDaysAgo.toISOString().slice(0, 10);

const { data: weekCheckins } = await supabase
  .from("habit_checkins")
  .select("habit_id, checkin_date")
  .eq("user_id", userId)
  .gte("checkin_date", sevenDaysAgoISO);

setLast7Checkins(weekCheckins || []);
    setHabits(
      (habitRows || []).map((h) => ({
        ...h,
        checkedInToday: checkedInIds.has(h.id),
      }))
    );
    setLoading(false);
  }

  async function toggleCheckIn(habit) {
    if (habit.checkedInToday) return; // MVP: no un-checking, keep it simple + honest

    // Optimistic UI update
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
      // Roll back optimistic update on failure
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

    // Re-sync with DB-computed streak (trigger already updated it server-side)
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
      <FlowScore userId={userId} />
      <WeeklyStats habits={habits} last7DaysCheckins={last7Checkins} />

      {error && <div className="ember-error">{error}</div>}

      {notifStatus === "default" && (
        <div className="ember-notif-banner">
          <span>Get a nudge when you haven't checked in.</span>
          <button onClick={enableNotifications}>Turn on reminders</button>
        </div>
      )}

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
              <button
                className="ember-name ember-name-btn"
                onClick={() => setHeatmapHabit(habit)}
              >
                {habit.name}
                <span className="ember-name-hint">▸</span>
              </button>
              <div className="ember-streak">
                <span className="ember-dot" style={emberStyle(habit.current_streak)} />
                <span className="ember-streak-count">{habit.current_streak}d</span>
              </div>
              <WeekBar
  checkinDates={
    new Set(
      last7Checkins
        .filter((c) => c.habit_id === habit.id)
        .map((c) => c.checkin_date)
    )
  }
/>
            </div>

            <button
              className="ember-edit-btn"
              onClick={() => setEditingHabit(habit)}
              aria-label={`Edit ${habit.name}`}
            >
              ✎
            </button>
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

      {heatmapHabit && (
        <HabitHeatmap
          habit={heatmapHabit}
          userId={userId}
          onClose={() => setHeatmapHabit(null)}
        />
      )}

      {editingHabit && (
        <EditHabitModal
          habit={editingHabit}
          onClose={() => setEditingHabit(null)}
          onUpdated={(updatedHabit) => {
            setHabits((prev) =>
              prev.map((h) =>
                h.id === updatedHabit.id
                  ? { ...h, name: updatedHabit.name, icon: updatedHabit.icon }
                  : h
              )
            );
            setEditingHabit(null);
          }}
          onDeleted={(habitId) => {
            setHabits((prev) => prev.filter((h) => h.id !== habitId));
            setEditingHabit(null);
          }}
        />
      )}
    </div>
  );
}