import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient"; // adjust path to your Supabase client
import "./FlowScore.css";

/**
 * EMBER — Flow Score
 * -------------------------------------------------------------
 * A single 0-100 number representing overall discipline
 * consistency across all active habits, computed server-side by
 * the get_flow_score() Postgres function (reads from `signals`).
 *
 * Rendered as one large glowing ember — the same visual language
 * as the per-habit streak dot, scaled up to represent the whole
 * week at once. Replaces "ten scattered stats" with one number
 * worth protecting.
 *
 * Props:
 *   userId: string
 * -------------------------------------------------------------
 */

function flowGlowStyle(score) {
  const glow = 6 + (score / 100) * 34; // px blur radius
  const size = 64 + (score / 100) * 40; // px diameter
  const hue = score >= 70 ? "#F5A623" : score >= 40 ? "#EA580C" : "#992E0C";
  return {
    width: `${size}px`,
    height: `${size}px`,
    backgroundColor: hue,
    boxShadow: `0 0 ${glow}px ${hue}`,
  };
}

function flowMessage(score) {
  if (score >= 80) return "Burning bright.";
  if (score >= 50) return "Steady fire.";
  if (score >= 20) return "Barely holding.";
  return "Needs kindling.";
}

export default function FlowScore({ userId }) {
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) fetchScore();
  }, [userId]);

  async function fetchScore() {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_flow_score", {
      p_user_id: userId,
    });

    if (!error && data !== null) {
      setScore(data);
    }
    setLoading(false);
  }

  if (loading) {
    return <div className="ember-flowscore ember-flowscore-loading" />;
  }

  if (score === null) return null;

  return (
    <div className="ember-flowscore">
      <div className="ember-flowscore-glow" style={flowGlowStyle(score)} />
      <div className="ember-flowscore-text">
        <span className="ember-flowscore-number">{score}</span>
        <span className="ember-flowscore-label">{flowMessage(score)}</span>
      </div>
    </div>
  );
}