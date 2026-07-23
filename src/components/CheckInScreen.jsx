import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabaseClient"; // adjust path to your Supabase client
import AddHabitModal from "./AddHabitModal";
import EditHabitModal from "./EditHabitModal";
import HabitHeatmap from "./HabitHeatmap";
import WeeklyStats from "./WeeklyStats";
import WeekBar from "./WeekBar";
import FlowScore from "./FlowScore";
import CollectiveImpact from "./CollectiveImpact";
import StreakRiskBanner from "./StreakRiskBanner";
import TodayImpactBand from "./TodayImpactBand";
import { CHECKIN_MESSAGES, STREAK_7_MESSAGES, STREAK_30_MESSAGES, getRandomMessage } from "./celebrationMessages";
import ImpactExplainer from "./ImpactExplainer";
import NorthStar from "./NorthStar";
import PillarScores from "./PillarScores";
import ImpactCertificate from "./ImpactCertificate";
import FocusTimer from "./FocusTimer";
import AnalyticsDashboard from "./AnalyticsDashboard";
import PodScreen from "./PodScreen";
import SideMenu from "./SideMenu";
import RecoveryPrompt from "./RecoveryPrompt";
import ParticleBurst from "./ParticleBurst";
import VitalCheckScreen from "./VitalCheckScreen";
import "./CheckInScreen.css";

/**
 * EMBER — Check-in Screen
 * -------------------------------------------------------------
 * Wiring notes for your Supabase project (already live schema):
 *
 * - habits: id, user_id, name, icon, color, frequency, is_active,
 *           current_streak, longest_streak, last_checkin_date, token_tier
 * - habit_checkins: id, habit_id, user_id, checkin_date, note, created_at
 * - A DB trigger (on_checkin_insert) already updates current_streak
 *   on habits automatically when a checkin row is inserted.
 *   -> This component does NOT recompute streaks client-side.
 *      It just inserts the checkin and re-fetches habits after.
 *
 * VERIFIED TOKENS RESTRUCTURE (token_tier):
 * - token_tier 3 (default): tokens are never awarded for this habit's
 *   check-ins — streaks/badges/celebration copy all work exactly as
 *   before, just no award_tokens() call. Most habits stay tier 3.
 * - token_tier 1 (workout): tokens ARE awarded, but only if a recent
 *   Vital Check scan (within the last 15 minutes) shows heart rate
 *   meaningfully elevated above the user's own resting baseline —
 *   real physiological evidence the workout happened. No new sensor
 *   or screen needed; reuses the existing vital_checks table.
 * - Tier 2 (focus sessions) isn't a habits row — FocusTimer.jsx's
 *   existing screen-presence rule already IS verification, no change
 *   needed there.
 *
 * Replace MOCK_HABITS below with a real fetch (see fetchHabits()).
 * -------------------------------------------------------------
 */

const MOCK_HABITS = [
  { id: "1", name: "Cold shower", icon: "💧", current_streak: 12, checkedInToday: false, token_tier: 3 },
  { id: "2", name: "Read 20 pages", icon: "📖", current_streak: 34, checkedInToday: true, token_tier: 3 },
  { id: "3", name: "No sugar", icon: "🍬", current_streak: 3, checkedInToday: false, token_tier: 3 },
  { id: "4", name: "Gym", icon: "🏋️", current_streak: 58, checkedInToday: false, token_tier: 1 },
];

// Ember glow intensity scales with streak length — the signature element.
function emberStyle(streak) {
  let hue, glow, opacity, animation;

  if (streak >= 30) {
    hue = "#60A5FA"; // intense blue flame
    glow = 26;
    opacity = 1;
    animation = "ember-pulse-intense 1.4s ease-in-out infinite";
  } else if (streak >= 7) {
    hue = "#F5A623"; // warm amber glow
    glow = 18;
    opacity = 0.9;
    animation = "ember-pulse 2s ease-in-out infinite";
  } else {
    const clamped = Math.min(streak, 6);
    hue = "#EA580C";
    glow = 4 + (clamped / 6) * 10;
    opacity = 0.35 + (clamped / 6) * 0.4;
    animation = "none";
  }

  return {
    boxShadow: `0 0 ${glow}px ${hue}`,
    backgroundColor: hue,
    opacity,
    animation,
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
  const [last7Checkins, setLast7Checkins] = useState([]); 
  const [celebration, setCelebration] = useState(null);
  const [showExplainer, setShowExplainer] = useState(false);
  const [showNorthStar, setShowNorthStar] = useState(false);
  const [northStar, setNorthStar] = useState(null);
  const [userTier, setUserTier] = useState("free");
  const [showCertificate, setShowCertificate] = useState(false);
  const [username, setUsername] = useState("");
  const [showTimer, setShowTimer] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false);
  const [showPod, setShowPod] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showPillarsModal, setShowPillarsModal] = useState(false);
  const [showImpactModal, setShowImpactModal] = useState(false);
  const [showVitalCheck, setShowVitalCheck] = useState(false);
  const [burstHabitId, setBurstHabitId] = useState(null);// unknown | default | granted | denied

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
  if (userId) {
    fetchHabits();
    fetchNorthStar();
  }
}, [userId]);
  useEffect(() => {
  if (userId && !localStorage.getItem(`ember_explainer_seen_${userId}`)) {
    setShowExplainer(true);
  }
}, [userId]);
useEffect(() => {
  if (userId && !localStorage.getItem(`ember_northstar_seen_${userId}`)) {
    setShowNorthStar(true);
  }
}, [userId]);

  async function fetchHabits() {
    setLoading(true);
    setError(null);
    const today = todayISO();

    const { data: habitRows, error: habitsErr } = await supabase
      .from("habits")
      .select("id, name, icon, current_streak, is_active, reminder_time, pillar, token_tier")
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
  async function fetchNorthStar() {
  const { data } = await supabase
    .from("profiles")
    .select("north_star, tier, username")
    .eq("id", userId)
    .single();
  setNorthStar(data?.north_star || null);
  setUserTier(data?.tier || "free");
  setUsername(data?.username || "");
}

  // Verified-tokens check for a Tier 1 (workout) habit: was there a Vital
  // Check scan in the last 15 minutes showing BPM meaningfully above this
  // user's own resting baseline (average of their last 5 scans)? Reuses the
  // existing vital_checks table — no new sensor, no new screen.
  async function checkWorkoutVerification() {
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const { data: recentScans } = await supabase
      .from("vital_checks")
      .select("bpm, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(6);

    if (!recentScans || recentScans.length === 0) return false;

    const latest = recentScans[0];
    if (latest.created_at < fifteenMinAgo) return false; // not recent enough

    const priorScans = recentScans.slice(1);
    if (priorScans.length === 0) return false; // no baseline to compare against yet

    const baselineBpm = priorScans.reduce((sum, s) => sum + s.bpm, 0) / priorScans.length;
    return latest.bpm >= baselineBpm * 1.2; // at least 20% elevation
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
    setBurstHabitId(habit.id);
setTimeout(() => setBurstHabitId(null), 700);

   const { data: insertedCheckin, error: insertErr } = await supabase
      .from("habit_checkins")
      .insert({
        habit_id: habit.id,
        user_id: userId,
        checkin_date: todayISO(),
      })
      .select()
      .single();

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

    // Verified-tokens routing: Tier 3 habits never call award_tokens at all.
    // Tier 1 (workout) habits only call it if the workout was verified via a
    // recent elevated Vital Check scan.
    if (habit.token_tier === 3) {
      setCelebration(getRandomMessage(CHECKIN_MESSAGES));
      setTimeout(() => setCelebration(null), 4000);
    } else if (habit.token_tier === 1) {
      const verified = await checkWorkoutVerification();

      if (verified) {
        const { data: signalRow } = await supabase
          .from("signals")
          .select("id")
          .eq("habit_id", habit.id)
          .eq("occurred_at", insertedCheckin.created_at)
          .single();

        const { error: tokenErr } = await supabase.rpc("award_tokens", {
          p_user_id: userId,
          p_signal_id: signalRow?.id,
          p_token_type: "workout",
          p_occurred_at: new Date().toISOString(),
        });
        if (tokenErr) console.error("award_tokens failed:", tokenErr);
        setCelebration(getRandomMessage(CHECKIN_MESSAGES));
        setTimeout(() => setCelebration(null), 4000);
      } else {
        setCelebration("Checked in — scan Vital Check right after your workout next time to earn tokens for it.");
        setTimeout(() => setCelebration(null), 5000);
      }
    }

    if (habit.pillar === "body") {
      setShowRecoveryPrompt(true);
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
        <button className="ember-menu-toggle" onClick={() => setShowMenu(true)}>☰</button>
        <p className="ember-eyebrow">Today</p>
        <h1 className="ember-title">Keep the fire lit.</h1>
        {northStar && (
  <button className="ember-northstar-display" onClick={() => setShowNorthStar(true)}>
    Becoming: {northStar} <span className="ember-northstar-edit-hint">✎</span>
  </button>
)}
        <p className="ember-subcount">
          {doneCount} of {habits.length} done
        </p>
      </header>
      <FlowScore userId={userId} />
<WeeklyStats habits={habits} last7DaysCheckins={last7Checkins} />
<TodayImpactBand userId={userId} />
      <button className="ember-timer-trigger" onClick={() => setShowTimer(true)}>
  ⏱ Start Deep Work
</button>

      {error && <div className="ember-error">{error}</div>}
      {celebration && (
  <div className="ember-celebration">
    {celebration}
    {userTier === "paid" && <span className="ember-multiplier-badge"> ×2 impact</span>}
  </div>
)}

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

      {habits
        .filter((h) => !h.checkedInToday && h.current_streak > 0)
        .map((h) => (
          <StreakRiskBanner
            key={h.id}
            habit={h}
            userId={userId}
            onDismiss={() => document.getElementById(`habit-${h.id}`)?.scrollIntoView({ behavior: "smooth" })}
          />
        ))}

      <ul className="ember-list">
        {habits.map((habit) => (
          <li key={habit.id} id={`habit-${habit.id}`} className={`ember-row ${habit.checkedInToday ? "is-done" : ""}`}>
            <button
  className="ember-checkbox"
  onClick={() => toggleCheckIn(habit)}
  disabled={habit.checkedInToday}
  aria-label={
    habit.checkedInToday
      ? `${habit.name} already checked in today`
      : `Check in ${habit.name}`
  }
  style={{ position: "relative" }}
>
  {habit.checkedInToday ? "✓" : ""}
  <ParticleBurst trigger={burstHabitId === habit.id} />
</button>

            <span className="ember-icon">{habit.icon}</span>

            <div className="ember-row-main">
              <button
                className="ember-name ember-name-btn"
                onClick={() => setHeatmapHabit(habit)}
              >
                {habit.name}
                {habit.token_tier === 1 && <span className="ember-tier-badge" title="Verified habit — earns tokens">🪙</span>}
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
                  ? { ...h, name: updatedHabit.name, icon: updatedHabit.icon, token_tier: updatedHabit.token_tier }
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
      {showExplainer && (
  <ImpactExplainer
    onClose={() => {
      localStorage.setItem(`ember_explainer_seen_${userId}`, "true");
      setShowExplainer(false);
    }}
  />
)}
{showNorthStar && (
  <NorthStar
    userId={userId}
    currentValue={northStar}
    onClose={() => {
      localStorage.setItem(`ember_northstar_seen_${userId}`, "true");
      setShowNorthStar(false);
      fetchNorthStar();
    }}
  />
)}
{showCertificate && (
  <ImpactCertificate
    userId={userId}
    tier={userTier}
    username={username}
    onClose={() => setShowCertificate(false)}
  />
)}
{showTimer && (
  <FocusTimer userId={userId} habits={habits} onClose={() => setShowTimer(false)} />
)}
{showAnalytics && (
  <AnalyticsDashboard userId={userId} tier={userTier} onClose={() => setShowAnalytics(false)} />
)}
{showRecoveryPrompt && (
  <RecoveryPrompt
    onStartRecovery={() => { setShowRecoveryPrompt(false); setShowTimer(true); }}
    onDismiss={() => setShowRecoveryPrompt(false)}
  />
)}
{showPod && (
  <PodScreen userId={userId} tier={userTier} onClose={() => setShowPod(false)} />
)}
{showVitalCheck && (
  <VitalCheckScreen userId={userId} onClose={() => setShowVitalCheck(false)} />
)}
<SideMenu
  isOpen={showMenu}
  onClose={() => setShowMenu(false)}
  onOpenPillars={() => setShowPillarsModal(true)}
  onOpenImpact={() => setShowImpactModal(true)}
  onOpenCertificate={() => setShowCertificate(true)}
  onOpenAnalytics={() => setShowAnalytics(true)}
  onOpenPod={() => setShowPod(true)}
  onOpenNorthStar={() => setShowNorthStar(true)}
  onOpenVitalCheck={() => setShowVitalCheck(true)}
/>
{showPillarsModal && (
  <div className="ember-simple-modal-backdrop" onClick={() => setShowPillarsModal(false)}>
    <div className="ember-simple-modal-card" onClick={(e) => e.stopPropagation()}>
      <PillarScores userId={userId} />
      <button className="ember-cert-close" onClick={() => setShowPillarsModal(false)}>Close</button>
    </div>
  </div>
)}
{showImpactModal && (
  <div className="ember-simple-modal-backdrop" onClick={() => setShowImpactModal(false)}>
    <div className="ember-simple-modal-card" onClick={(e) => e.stopPropagation()}>
      <CollectiveImpact tier={userTier} />
      <button className="ember-cert-close" onClick={() => setShowImpactModal(false)}>Close</button>
    </div>
  </div>
)}
    </div>
  );
}