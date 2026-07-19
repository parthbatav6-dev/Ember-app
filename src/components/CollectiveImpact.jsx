import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "./CollectiveImpact.css";

export default function CollectiveImpact() {
  const [impact, setImpact] = useState({ meals_funded: 0 });

  useEffect(() => {
    fetchImpact();
  }, []);

  async function fetchImpact() {
    const { data } = await supabase
      .from("collective_impact")
      .select("meals_funded")
      .single();
    if (data) setImpact(data);
  }

  return (
    <div className="ember-impact">
      <p className="ember-impact-label">Collective impact</p>
      <p className="ember-impact-value">{impact.meals_funded || 0} meals funded</p>
    </div>
  );
}