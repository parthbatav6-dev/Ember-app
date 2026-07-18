import "./WeekBar.css";

/**
 * EMBER — 7-day mini bar strip
 * -------------------------------------------------------------
 * Shows the last 7 days as small vertical bars — filled/glowing
 * for done, dim for missed, hollow for today (not yet due/decided).
 *
 * Props:
 *   checkinDates: Set<string> of "YYYY-MM-DD" dates this habit
 *     was completed on, within the last 7 days.
 * -------------------------------------------------------------
 */

function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export default function WeekBar({ checkinDates }) {
  const days = getLast7Days();
  const today = days[days.length - 1];

  return (
    <div className="ember-weekbar">
      {days.map((date) => {
        const isToday = date === today;
        const done = checkinDates.has(date);
        return (
          <span
            key={date}
            className={`ember-weekbar-day ${done ? "is-done" : ""} ${
              isToday ? "is-today" : ""
            }`}
            title={date}
          />
        );
      })}
    </div>
  );
}