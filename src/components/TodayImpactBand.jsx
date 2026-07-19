import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "./TodayImpactBand.css";

export default function TodayImpactBand({ userId }) {
  const [todayTokens, setTodayTokens] = useState(0);

  useEffect(() => {
    if (userId) fetchToday();
  }, [userId]);

  async function fetchToday() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from("impact_ledger")
      .select("tokens")
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .gte("occurred_at", startOfDay.toISOString());

    const total = (data || []).reduce((sum, row) => sum + row.tokens, 0);
    setTodayTokens(total);
  }

  if (todayTokens === 0) return null;

  return (
    <div className="ember-today-band">
      <span className="ember-today-label">Today's focus</span>
      <span className="ember-today-arrow">→</span>
      <span className="ember-today-value">{todayTokens} tokens toward impact</span>
    </div>
  );
}