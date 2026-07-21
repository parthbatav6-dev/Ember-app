import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import "./PodScreen.css";

export default function PodScreen({ userId, tier, onClose }) {
  const [pod, setPod] = useState(null);
  const [members, setMembers] = useState([]);
  const [podName, setPodName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState(null);
  const [bonusEarned, setBonusEarned] = useState(false);

  useEffect(() => {
    fetchMyPod();
  }, [userId]);

  async function fetchMyPod() {
  const { data: membership } = await supabase
    .from("pod_members")
    .select("pod_id, pods(id, name, join_code)")
    .eq("user_id", userId)
    .single();

  if (membership?.pods) {
    setPod(membership.pods);
    const { data: statusRows } = await supabase.rpc("get_pod_today_status", { p_pod_id: membership.pods.id });
    setMembers(statusRows || []);

    const allDone = (statusRows || []).every((m) => m.habits_done >= m.habits_total && m.habits_total > 0);
    if (allDone) {
      const { data: bonusAwarded } = await supabase.rpc("check_and_award_pod_bonus", { p_pod_id: membership.pods.id });
      if (bonusAwarded) setBonusEarned(true);
    }
  }
}

  async function createPod() {
    if (!podName.trim()) return;
    const { data: newPod, error: createErr } = await supabase
      .from("pods")
      .insert({ name: podName.trim(), created_by: userId })
      .select()
      .single();

    if (createErr) { setError("Couldn't create pod."); return; }

    await supabase.from("pod_members").insert({ pod_id: newPod.id, user_id: userId });
    fetchMyPod();
  }

  async function joinPod() {
    if (!joinCode.trim()) return;
    const { data: targetPod, error: findErr } = await supabase
      .from("pods")
      .select("id")
      .eq("join_code", joinCode.trim().toLowerCase())
      .single();

    if (findErr || !targetPod) { setError("No pod found with that code."); return; }

    const { error: joinErr } = await supabase
      .from("pod_members")
      .insert({ pod_id: targetPod.id, user_id: userId });

    if (joinErr) { setError("Couldn't join — you may already be in this pod."); return; }
    fetchMyPod();
  }

  return (
    <div className="ember-pod-backdrop" onClick={onClose}>
      <div className="ember-pod-card" onClick={(e) => e.stopPropagation()}>
        <p className="ember-pod-eyebrow">Pod</p>

        {pod ? (
          <>
            <h2 className="ember-pod-title">{pod.name}</h2>
            <p className="ember-pod-code">Share code: <strong>{pod.join_code}</strong></p>
            {tier === "paid" && (
  <p className="ember-pod-bonus">
    {bonusEarned ? "✨ Bonus earned today — everyone completed!" : "✨ If everyone completes today, paid members earn a token bonus."}
  </p>
)}
            <div className="ember-pod-members">
              {members.map((m) => (
                <div key={m.user_id} className="ember-pod-member-row">
                  <span>{m.username || "Member"}</span>
                  <span>{m.habits_done}/{m.habits_total} today</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <h2 className="ember-pod-title">Join or start a pod</h2>
            <input
              className="ember-pod-input"
              placeholder="Pod name"
              value={podName}
              onChange={(e) => setPodName(e.target.value)}
            />
            <button className="ember-pod-cta" onClick={createPod}>Create pod</button>

            <p className="ember-pod-or">or</p>

            <input
              className="ember-pod-input"
              placeholder="Enter join code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
            />
            <button className="ember-pod-cta" onClick={joinPod}>Join pod</button>

            {error && <p className="ember-pod-error">{error}</p>}
          </>
        )}

        <button className="ember-pod-close" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}