import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "./PillarScores.css";

const PILLAR_LABELS = { body: "Body", mind: "Mind", character: "Character" };

export default function PillarScores({ userId }) {
  const [scores, setScores] = useState({});

  useEffect(() => {
    if (userId) fetchScores();
  }, [userId]);

  async function fetchScores() {
    const { data } = await supabase.rpc("get_pillar_scores", { p_user_id: userId });
    const map = {};
    (data || []).forEach((row) => { map[row.pillar] = row.score; });
    setScores(map);
  }

  return (
    <div className="ember-pillars">
      {Object.keys(PILLAR_LABELS).map((key) => (
        <div key={key} className="ember-pillar">
          <div className="ember-pillar-bar-track">
            <div className="ember-pillar-bar-fill" style={{ width: `${scores[key] || 0}%` }} />
          </div>
          <p className="ember-pillar-label">{PILLAR_LABELS[key]} — {scores[key] || 0}%</p>
        </div>
      ))}
    </div>
  );
}