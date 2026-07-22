import "./SideMenu.css";

export default function SideMenu({
  isOpen, onClose,
  onOpenPillars, onOpenImpact, onOpenCertificate, onOpenAnalytics, onOpenPod, onOpenNorthStar, onOpenVitalCheck
}) {
  return (
    <>
      <div className={`ember-menu-backdrop ${isOpen ? "is-open" : ""}`} onClick={onClose} />
      <div className={`ember-menu-panel ${isOpen ? "is-open" : ""}`}>
        <p className="ember-menu-eyebrow">Ember</p>
        <button className="ember-menu-item" onClick={() => { onOpenNorthStar(); onClose(); }}>Your North Star</button>
        <button className="ember-menu-item" onClick={() => { onOpenPillars(); onClose(); }}>Body / Mind / Character</button>
        <button className="ember-menu-item" onClick={() => { onOpenImpact(); onClose(); }}>Collective Impact</button>
        <button className="ember-menu-item" onClick={() => { onOpenCertificate(); onClose(); }}>Impact Certificate</button>
        <button className="ember-menu-item" onClick={() => { onOpenAnalytics(); onClose(); }}>My Insights</button>
        <button className="ember-menu-item" onClick={() => { onOpenPod(); onClose(); }}>My Pod</button>
        <button className="ember-menu-item" onClick={() => { onOpenVitalCheck(); onClose(); }}>Vital Check</button>
      </div>
    </>
  );
}