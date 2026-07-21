import { useEffect, useState } from "react";
import "./ParticleBurst.css";

const PARTICLES = Array.from({ length: 8 });

export default function ParticleBurst({ trigger }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (trigger) {
      setShow(true);
      const t = setTimeout(() => setShow(false), 600);
      return () => clearTimeout(t);
    }
  }, [trigger]);

  if (!show) return null;

  return (
    <div className="ember-particle-container">
      {PARTICLES.map((_, i) => {
        const angle = (i / PARTICLES.length) * 360;
        const distance = 30 + Math.random() * 15;
        const dx = Math.cos((angle * Math.PI) / 180) * distance;
        const dy = Math.sin((angle * Math.PI) / 180) * distance - 20;
        return (
          <span
            key={i}
            className="ember-particle"
            style={{ "--dx": `${dx}px`, "--dy": `${dy}px` }}
          />
        );
      })}
    </div>
  );
}