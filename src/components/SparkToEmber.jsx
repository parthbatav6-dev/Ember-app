import { useEffect, useState } from "react";
import "./SparkToEmber.css";

/**
 * SparkToEmber
 * Staged fire visual for the Deep Work Timer.
 * Stages progress with session completion (coal -> spark -> flame -> ember spirit).
 * On break, plays a smoke/ash extinguish animation instead of the fire stages.
 *
 * Props:
 *  - progress: number 0..1, fraction of the focus session elapsed
 *  - status: "running" | "complete" | "broken"
 *      "running"  -> fire stages driven by progress
 *      "complete" -> ember spirit, settled/steady state
 *      "broken"   -> smoke/ash extinguish animation (session broken early)
 */
export default function SparkToEmber({ progress = 0, status = "running" }) {
  const [stage, setStage] = useState("coal");

  useEffect(() => {
    if (status === "broken") {
      setStage("extinguish");
      return;
    }
    if (status === "complete") {
      setStage("spirit");
      return;
    }
    if (progress < 0.15) setStage("coal");
    else if (progress < 0.4) setStage("spark");
    else if (progress < 0.75) setStage("flame");
    else setStage("spirit");
  }, [progress, status]);

  return (
    <div className={`ste-container ste-stage-${stage}`} aria-hidden="true">
      <div className="ste-glow" />

      {/* Coal: dim base ember, always present under the flame */}
      <div className="ste-coal" />

      {/* Spark: small flickering point, visible in spark/flame/spirit stages */}
      <div className="ste-spark">
        <span className="ste-spark-dot" />
      </div>

      {/* Flame: rising tongues of flame, visible in flame/spirit stages */}
      <div className="ste-flame">
        <span className="ste-flame-core" />
        <span className="ste-flame-outer" />
      </div>

      {/* Ember spirit: soft aura + wisp that appears at full stage */}
      <div className="ste-spirit">
        <span className="ste-spirit-aura" />
        <span className="ste-spirit-wisp" />
      </div>

      {/* Smoke/ash: extinguish animation, only visible in "broken" status */}
      <div className="ste-smoke">
        <span className="ste-smoke-puff ste-smoke-1" />
        <span className="ste-smoke-puff ste-smoke-2" />
        <span className="ste-smoke-puff ste-smoke-3" />
        <span className="ste-ash" />
      </div>
    </div>
  );
}