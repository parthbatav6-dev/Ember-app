import { useMemo } from "react";
import "./WeeklyStats.css";

/**
 * EMBER — Weekly stats summary
 * -------------------------------------------------------------
 * Pure presentation component — takes the already-fetched habits
 * array (with current_streak) and a checkins array covering the
 * last 7 days, computes aggregate stats client-side.
 *
 * Props:
 *   habits: [{ id, current_streak, ... }]
 *   last7DaysCheckins: [{ habit_id, checkin_date }]  — flat list,
 *     one row per completed check-in in the last 7 days, across
 *     all habits. Fetch this alongside habits in CheckInScreen.
 * -------------------------------------------------------------
 */

export default function WeeklyStats({ habits, last7DaysCheckins }) {
  const stats = useMemo(() => {
    const activeCount = habits.length;
    const possibleCheckins = activeCount * 7;
    const actualCheckins = last7DaysCheckins.length;
    const completionRate =
      possibleCheckins === 0 ? 0 : Math.round((actualCheckins / possibleCheckins) * 100);
    const bestStreak = habits.reduce(
      (max, h) => Math.max(max, h.current_streak || 0),
      0
    );

    return { activeCount, completionRate, bestStreak };
  }, [habits, last7DaysCheckins]);

  return (
    <div className="ember-stats">
      <div className="ember-stat">
        <span className="ember-stat-value">{stats.completionRate}%</span>
        <span className="ember-stat-label">this week</span>
      </div>
      <div className="ember-stat-divider" />
      <div className="ember-stat">
        <span className="ember-stat-value">{stats.bestStreak}d</span>
        <span className="ember-stat-label">best streak</span>
      </div>
      <div className="ember-stat-divider" />
      <div className="ember-stat">
        <span className="ember-stat-value">{stats.activeCount}</span>
        <span className="ember-stat-label">active habits</span>
      </div>
    </div>
  );
}