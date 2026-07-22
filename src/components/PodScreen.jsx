import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import "./PodScreen.css";

export default function PodScreen({ userId, tier, onClose }) {
  const [pods, setPods] = useState([]);
  const [podStatus, setPodStatus] = useState({}); // pod_id -> { members, bonusEarned }
  const [podName, setPodName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMyPods();
  }, [userId]);

  async function fetchMyPods() {
    const { data: memberships } = await supabase
      .from("pod_members")
      .select("pod_id, pods(id, name, join_code, created_by)")
      .eq("user_id", userId);

    const myPods = (memberships || []).map((m) => m.pods).filter(Boolean);
    setPods(myPods);

    for (const p of myPods) {
      const { data: statusRows } = await supabase.rpc("get_pod_today_status", { p_pod_id: p.id });
      const allDone = (statusRows || []).every((m) => m.habits_done >= m.habits_total && m.habits_total > 0);
      let bonusEarned = false;
      if (allDone) {
        const { data: bonusAwarded } = await supabase.rpc("check_and_award_pod_bonus", { p_pod_id: p.id });
        bonusEarned = !!bonusAwarded;
      }
      setPodStatus((prev) => ({ ...prev, [p.id]: { members: statusRows || [], bonusEarned } }));
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
    setPodName("");
    setError(null);
    fetchMyPods();
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
    setJoinCode("");
    setError(null);
    fetchMyPods();
  }

  async function handleLeave(podId) {
    await supabase.rpc("leave_pod", { p_pod_id: podId, p_user_id: userId });
    fetchMyPods();
  }

  async function handleDelete(podId) {
    const { error: delErr } = await supabase.rpc("delete_pod", { p_pod_id: podId, p_user_id: userId });
    if (delErr) { setError("Only the creator can delete this pod."); return; }
    fetchMyPods();
  }

  return (
    <div className="ember-pod-backdrop" onClick={onClose}>
      <div className="ember-pod-card" onClick={(e) => e.stopPropagation()}>
        <p className="ember-pod-eyebrow">Pods</p>

        {pods.map((pod) => {
          const status = podStatus[pod.id] || { members: [], bonusEarned: false };
          const isCreator = pod.created_by === userId;
          return (
            <div key={pod.id} className="ember-pod-block">
              <h2 className="ember-pod-title">{pod.name}</h2>
              <p className="ember-pod-code">Share code: <strong>{pod.join_code}</strong></p>
              {tier === "paid" && (
                <p className="ember-pod-bonus">
                  {status.bonusEarned ? "✨ Bonus earned today — everyone completed!" : "✨ If everyone completes today, paid members earn a token bonus."}
                </p>
              )}
              <div className="ember-pod-members">
                {status.members.map((m) => (
                  <div key={m.user_id} className="ember-pod-member-row">
                    <span>{m.username || "Member"}</span>
                    <span>{m.habits_done}/{m.habits_total} today</span>
                  </div>
                ))}
              </div>
              {isCreator ? (
                <button className="ember-pod-danger" onClick={() => handleDelete(pod.id)}>Delete pod</button>
              ) : (
                <button className="ember-pod-danger" onClick={() => handleLeave(pod.id)}>Leave pod</button>
              )}
            </div>
          );
        })}

        <h2 className="ember-pod-title">Join or start another pod</h2>
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

        <button className="ember-pod-close" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}