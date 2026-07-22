import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import SparkToEmber from "./SparkToEmber";
import "./FocusTimer.css";

const DURATIONS = [
  { label: "30 min", seconds: 1800 },
  { label: "60 min", seconds: 3600 },
];

export default function FocusTimer({ userId, habits, onClose }) {
  const [selectedDuration, setSelectedDuration] = useState(DURATIONS[0].seconds);
  const [selectedHabit, setSelectedHabit] = useState(habits?.[0]?.id || null);
  const [sessionId, setSessionId] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(DURATIONS[0].seconds);
  const [status, setStatus] = useState("idle"); // idle | running | completed | broken
  const intervalRef = useRef(null);
  const progress = selectedDuration > 0 ? 1 - secondsLeft / selectedDuration : 0;
  const visualStatus = status === "completed" ? "complete" : status;

  useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);

  // Loss-aversion: navigating away from this screen while running = broken session
  useEffect(() => {
    if (status !== "running") return;

    function handleVisibilityChange() {
      if (document.hidden) {
        breakSession();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [status, sessionId]);

  async function startSession() {
    const { data, error } = await supabase
      .from("focus_sessions")
      .insert({
        user_id: userId,
        habit_id: selectedHabit,
        duration_seconds: selectedDuration,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to start session:", error);
      return;
    }

    setSessionId(data.id);
    setSecondsLeft(selectedDuration);
    setStatus("running");

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          completeSession(data.id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function completeSession(id) {
    setStatus("completed");
    await supabase.rpc("complete_focus_session", { p_session_id: id });
  }

  async function breakSession() {
    clearInterval(intervalRef.current);
    setStatus("broken");
    if (sessionId) {
      await supabase.rpc("break_focus_session", { p_session_id: sessionId });
    }
  }

  function formatTime(s) {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  }

  return (
    <div className="ember-timer-backdrop">
      <div className="ember-timer-card">
        {status === "idle" && (
          <>
            <p className="ember-timer-eyebrow">Deep Work</p>
            <h2 className="ember-timer-title">Start a session</h2>

            <div className="ember-timer-durations">
              {DURATIONS.map((d) => (
                <button
                  key={d.seconds}
                  className={`ember-timer-duration-btn ${selectedDuration === d.seconds ? "is-selected" : ""}`}
                  onClick={() => { setSelectedDuration(d.seconds); setSecondsLeft(d.seconds); }}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {habits && habits.length > 0 && (
              <select
                className="ember-timer-habit-select"
                value={selectedHabit || ""}
                onChange={(e) => setSelectedHabit(e.target.value)}
              >
                {habits.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            )}

            <p className="ember-timer-warning">
              Leaving this screen while the timer runs breaks the session — pending tokens will be lost.
            </p>

            <button className="ember-timer-start" onClick={startSession}>Begin</button>
            <button className="ember-timer-cancel" onClick={onClose}>Cancel</button>
          </>
        )}

        {status === "running" && (
  <>
    <p className="ember-timer-eyebrow">Stay with it</p>
    <SparkToEmber progress={progress} status={visualStatus} />
    <div className="ember-timer-clock">{formatTime(secondsLeft)}</div>
    <p className="ember-timer-hint">Don't leave this screen.</p>
  </>
)}

        {status === "completed" && (
  <>
    <p className="ember-timer-eyebrow">Session complete</p>
    <SparkToEmber progress={1} status="complete" />
    <h2 className="ember-timer-title">You stayed the whole way.</h2>
    <p className="ember-timer-body">Your tokens are confirmed — real impact, earned.</p>
    <button className="ember-timer-start" onClick={onClose}>Done</button>
  </>
)}

        {status === "broken" && (
  <>
    <p className="ember-timer-eyebrow">Session broken</p>
    <SparkToEmber progress={progress} status="broken" />
    <h2 className="ember-timer-title">You left early.</h2>
    <p className="ember-timer-body">This session's tokens weren't earned. Your past impact is still safe.</p>
    <button className="ember-timer-start" onClick={onClose}>Close</button>
  </>
)}
      </div>
    </div>
  );
}