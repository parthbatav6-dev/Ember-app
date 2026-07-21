import "./RecoveryPrompt.css";

export default function RecoveryPrompt({ onStartRecovery, onDismiss }) {
  return (
    <div className="ember-recovery-backdrop" onClick={onDismiss}>
      <div className="ember-recovery-card" onClick={(e) => e.stopPropagation()}>
        <p className="ember-recovery-eyebrow">Nice work</p>
        <h2 className="ember-recovery-title">Want to ease into recovery?</h2>
        <p className="ember-recovery-body">
          A short, gentle focus block — deep breathing or mindfulness — can help your body actually absorb today's effort, instead of jumping straight into intense work.
        </p>
        <button className="ember-recovery-start" onClick={onStartRecovery}>
          Start 10-min recovery block
        </button>
        <button className="ember-recovery-skip" onClick={onDismiss}>
          Skip, I'm good
        </button>
      </div>
    </div>
  );
}