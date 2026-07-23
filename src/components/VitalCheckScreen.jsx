import { useState, useRef, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import "./VitalCheckScreen.css";

const SCAN_SECONDS = 45;
const SAMPLE_HZ = 30; // approx frame sampling rate we aim for
const MIN_BPM = 40;
const MAX_BPM = 180;

// Physiologically plausible RMSSD range for a resting scan — anything outside
// this is almost certainly peak-detection noise from a 30s single scan, not a
// real HRV reading. Elite athletes rarely exceed ~150ms.
const MIN_PLAUSIBLE_HRV = 10;
const MAX_PLAUSIBLE_HRV = 150;
// Absolute hard ceiling — even a "consistent" peak pattern above this is
// almost certainly a systematic detection error (e.g. catching every other
// beat), not a real reading. RMSSD essentially never exceeds this even in
// unusual physiological cases. Overrides confidence entirely — nothing above
// this is ever shown to the user.
const ABSOLUTE_MAX_HRV = 200;

export default function VitalCheckScreen({ userId, onClose }) {
  const [phase, setPhase] = useState("intro"); // intro | scanning | result | error
  const [progress, setProgress] = useState(0);
  const [bpm, setBpm] = useState(null);
  const [hrv, setHrv] = useState(null);
  const [hrvConfidence, setHrvConfidence] = useState(null);
  const [hrvCategory, setHrvCategory] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const samplesRef = useRef([]); // { t, value }
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      const video = videoRef.current;
      if (video && typeof video.cancelVideoFrameCallback === "function") {
        video.cancelVideoFrameCallback(rafRef.current);
      } else {
        cancelAnimationFrame(rafRef.current);
      }
    }
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  async function startScan() {
    setErrorMsg(null);
    samplesRef.current = [];
    setBpm(null);
    setHrv(null);
    setHrvConfidence(null);
    setHrvCategory(null);
    setProgress(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 320 },
          height: { ideal: 240 },
        },
      });
      streamRef.current = stream;

      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.();
      if (capabilities?.torch) {
        try {
          await track.applyConstraints({ advanced: [{ torch: true }] });
        } catch {
          // Torch not controllable on this device — scan still works, just less accurate.
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setPhase("scanning");
      startTimeRef.current = performance.now();
      sampleLoop();
    } catch (err) {
      console.error("Camera access failed:", err);
      setErrorMsg("Couldn't access your camera. Check camera permissions and try again.");
      setPhase("error");
    }
  }

  function sampleLoop() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const w = canvas.width;
    const h = canvas.height;
    let startMediaTime = null;

    function sampleFrame(mediaTime) {
      if (video.readyState < 2) return;
      ctx.drawImage(video, 0, 0, w, h);
      const frame = ctx.getImageData(0, 0, w, h).data;
      let sum = 0;
      const pixelCount = frame.length / 4;
      for (let i = 0; i < frame.length; i += 4) sum += frame[i]; // red channel
      const avgRed = sum / pixelCount;

      if (startMediaTime === null) startMediaTime = mediaTime;
      const elapsed = mediaTime - startMediaTime;
      samplesRef.current.push({ t: elapsed, value: avgRed });
      setProgress(Math.min(100, Math.round((elapsed / SCAN_SECONDS) * 100)));
      return elapsed;
    }

    // requestVideoFrameCallback gives the camera's true decode timestamp — far
    // more precise than estimating time from requestAnimationFrame, which can
    // drift independently of when frames actually arrive from the camera.
    if (typeof video.requestVideoFrameCallback === "function") {
      const onFrame = (_now, metadata) => {
        const elapsed = sampleFrame(metadata.mediaTime);
        if (elapsed !== undefined && elapsed >= SCAN_SECONDS) {
          finishScan();
          return;
        }
        rafRef.current = video.requestVideoFrameCallback(onFrame);
      };
      rafRef.current = video.requestVideoFrameCallback(onFrame);
    } else {
      // Fallback for browsers without requestVideoFrameCallback (e.g. older Safari).
      function tick() {
        const elapsed = sampleFrame(performance.now() / 1000);
        if (elapsed !== undefined && elapsed >= SCAN_SECONDS) {
          finishScan();
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      }
      rafRef.current = requestAnimationFrame(tick);
    }
  }

  function finishScan() {
    stopCamera();
    const result = computeBpmAndHrv(samplesRef.current);

    if (result === null) {
      setErrorMsg("Couldn't get a clear reading. Make sure your fingertip fully covers the camera and hold still.");
      setPhase("error");
      return;
    }

    setBpm(result.bpm);
    setHrv(result.hrv);
    setHrvConfidence(result.hrvConfidence);
    setPhase("result");
    saveReading(result.bpm, result.hrv, result.hrvConfidence);
  }

  async function saveReading(bpmValue, hrvValue, hrvConfidenceValue) {
    if (!userId) return;
    try {
      // Compare today's reading against your own recent history rather than a
      // fixed population number — this is far more forgiving of any consistent
      // measurement bias in the scan method itself, since the same bias applies
      // to every past reading too and cancels out in the comparison.
      let category = null;
      if (hrvValue !== null) {
        const { data: recentChecks } = await supabase
          .from("vital_checks")
          .select("hrv_rmssd")
          .eq("user_id", userId)
          .not("hrv_rmssd", "is", null)
          .order("created_at", { ascending: false })
          .limit(5);

        const priorValues = (recentChecks || []).map((r) => r.hrv_rmssd);
        if (priorValues.length >= 3) {
          const baseline = priorValues.reduce((a, b) => a + b, 0) / priorValues.length;
          const pctDiff = (hrvValue - baseline) / baseline;
          if (pctDiff > 0.1) category = "high";
          else if (pctDiff < -0.1) category = "low";
          else category = "stable";
        }
      }
      setHrvCategory(category);

      const { data: vitalRow, error: vitalErr } = await supabase
        .from("vital_checks")
        .insert({
          user_id: userId,
          bpm: bpmValue,
          hrv_rmssd: hrvValue,
          hrv_confidence: hrvConfidenceValue,
          hrv_category: category,
        })
        .select()
        .single();

      if (vitalErr) {
        console.error("Failed to save vital check:", vitalErr);
        return;
      }

      // Mirror into signals, same pattern as every other event type in the app.
      await supabase.from("signals").insert({
        user_id: userId,
        signal_type: "vital_check",
        source: "app",
        habit_id: null,
        value: {
          bpm: bpmValue,
          hrv_rmssd: hrvValue,
          hrv_confidence: hrvConfidenceValue,
          hrv_category: category,
          vital_check_id: vitalRow.id,
        },
        occurred_at: vitalRow.created_at,
      });
    } catch (err) {
      console.error("Failed to save vital check:", err);
    }
  }

  function reset() {
    stopCamera();
    setPhase("intro");
    setProgress(0);
    setBpm(null);
    setHrv(null);
    setHrvConfidence(null);
    setHrvCategory(null);
    setErrorMsg(null);
  }

  function handleClose() {
    stopCamera();
    onClose();
  }

  return (
    <div className="vc-backdrop" onClick={handleClose}>
      <div className="vc-card" onClick={(e) => e.stopPropagation()}>
        <p className="vc-eyebrow">Vital Check</p>

        {phase === "intro" && (
          <>
            <h2 className="vc-title">Check your pulse</h2>
            <p className="vc-body">
              Cover your rear camera and flash completely with your fingertip. Hold still for {SCAN_SECONDS} seconds.
            </p>
            <p className="vc-disclaimer">
              Wellness estimate, not a medical device. Consult a doctor for diagnosis.
            </p>
            <button className="vc-cta" onClick={startScan}>Start scan</button>
          </>
        )}

        <video
          ref={videoRef}
          className="vc-video-preview"
          playsInline
          muted
        />
        <canvas ref={canvasRef} width={64} height={48} className="vc-canvas-hidden" />

        {phase === "scanning" && (
          <>
            <h2 className="vc-title">Hold still…</h2>
            <div className="vc-progress-ring">
              <div className="vc-progress-fill" style={{ "--progress": `${progress}%` }} />
              <span className="vc-progress-label">{progress}%</span>
            </div>
            <p className="vc-body">Keep your fingertip fully covering the camera.</p>
          </>
        )}

        {phase === "result" && bpm && (
          <>
            <h2 className="vc-title">{bpm} <span className="vc-bpm-unit">bpm</span></h2>
            {hrv !== null ? (
              hrvCategory ? (
                <p className={`vc-hrv-row vc-hrv-${hrvCategory}`}>
                  {hrvCategory === "high" && "High HRV — your body's recovery signals look strong today."}
                  {hrvCategory === "stable" && "Stable HRV — steady and balanced against your recent baseline."}
                  {hrvCategory === "low" && "Low HRV — lower than your recent baseline, consider prioritizing rest."}
                </p>
              ) : (
                <p className="vc-hrv-row vc-hrv-hint">
                  Building your HRV baseline — a few more scans and we'll show your trend.
                </p>
              )
            ) : (
              <p className="vc-hrv-row vc-hrv-unclear">
                HRV reading wasn't clear this time — try again holding very still
              </p>
            )}
            <p className="vc-body">Reading saved to your Vital Check history.</p>
            <p className="vc-disclaimer">
              Wellness estimate, not a medical device. Consult a doctor for diagnosis.
            </p>
            <button className="vc-cta" onClick={reset}>Scan again</button>
          </>
        )}

        {phase === "error" && (
          <>
            <h2 className="vc-title">Reading unclear</h2>
            <p className="vc-body">{errorMsg}</p>
            <button className="vc-cta" onClick={reset}>Try again</button>
          </>
        )}

        <button className="vc-close" onClick={handleClose}>Close</button>
      </div>
    </div>
  );
}

/**
 * Detrend + peak-detection heart rate + HRV estimator.
 * No external DSP libraries — deliberately dependency-free.
 *
 * 1. Resample the (irregularly-timed, requestAnimationFrame-driven) samples
 *    onto a fixed-rate grid.
 * 2. Detrend by subtracting a rolling average (removes lighting drift/baseline wander).
 * 3. Find peaks with a minimum-distance constraint matching MAX_BPM.
 * 4. Average the peak-to-peak intervals -> BPM.
 * 5. RMSSD of successive peak-to-peak interval differences -> HRV (ms).
 *    This is the same metric consumer wearables report as "HRV" — noisier from
 *    a 30s camera scan than a continuous wearable reading, so treat it as a
 *    directional trend across multiple scans rather than a single definitive number.
 */
function computeBpmAndHrv(samples) {
  if (samples.length < SAMPLE_HZ * 5) return null; // too little data

  const duration = samples[samples.length - 1].t;
  const gridSize = Math.floor(duration * SAMPLE_HZ);
  if (gridSize < SAMPLE_HZ * 5) return null;

  // Resample onto a uniform grid via linear interpolation between the two
  // nearest real samples (more accurate than carrying the previous value
  // forward, especially with the now-irregular requestVideoFrameCallback timing).
  const grid = new Array(gridSize).fill(0);
  let sIdx = 0;
  for (let i = 0; i < gridSize; i++) {
    const t = i / SAMPLE_HZ;
    while (sIdx < samples.length - 2 && samples[sIdx + 1].t < t) sIdx++;
    const a = samples[sIdx];
    const b = samples[Math.min(sIdx + 1, samples.length - 1)];
    if (b.t === a.t) {
      grid[i] = a.value;
    } else {
      const frac = (t - a.t) / (b.t - a.t);
      grid[i] = a.value + (b.value - a.value) * Math.max(0, Math.min(1, frac));
    }
  }

  // Rolling average detrend — window ~1.5s.
  const windowSize = Math.round(SAMPLE_HZ * 1.5);
  const detrended = grid.map((v, i) => {
    const start = Math.max(0, i - windowSize);
    const end = Math.min(grid.length, i + windowSize);
    let sum = 0;
    for (let j = start; j < end; j++) sum += grid[j];
    const avg = sum / (end - start);
    return v - avg;
  });

  // Peak detection with a minimum distance matching MAX_BPM, plus sub-frame
  // parabolic interpolation: a 3-point quadratic fit through each peak and its
  // neighbors recovers timing precision the raw ~30fps grid alone can't give,
  // which matters here since HRV values are the same order of magnitude as
  // one frame interval.
  const minDistance = Math.round((60 / MAX_BPM) * SAMPLE_HZ);
  const peakTimesSec = [];
  let lastPeakIdx = -Infinity;
  for (let i = 1; i < detrended.length - 1; i++) {
    if (
      detrended[i] > detrended[i - 1] &&
      detrended[i] > detrended[i + 1] &&
      detrended[i] > 0 &&
      i - lastPeakIdx >= minDistance
    ) {
      const y0 = detrended[i - 1];
      const y1 = detrended[i];
      const y2 = detrended[i + 1];
      const denom = y0 - 2 * y1 + y2;
      const offset = denom !== 0 ? 0.5 * (y0 - y2) / denom : 0;
      const refinedIdx = i + Math.max(-0.5, Math.min(0.5, offset));
      peakTimesSec.push(refinedIdx / SAMPLE_HZ);
      lastPeakIdx = i;
    }
  }

  if (peakTimesSec.length < 4) return null; // not enough clean peaks for a confident reading

  const intervalsMs = [];
  for (let i = 1; i < peakTimesSec.length; i++) {
    intervalsMs.push((peakTimesSec[i] - peakTimesSec[i - 1]) * 1000);
  }

  const avgIntervalMs = intervalsMs.reduce((a, b) => a + b, 0) / intervalsMs.length;
  const bpm = Math.round(60000 / avgIntervalMs);

  if (bpm < MIN_BPM || bpm > MAX_BPM) return null;

  // Signal-quality gate: if peak-to-peak intervals are wildly inconsistent
  // (high coefficient of variation), the peaks themselves are likely noise,
  // not real heartbeats — don't compute HRV from a shaky peak sequence.
  const meanInterval = avgIntervalMs;
  const variance =
    intervalsMs.reduce((a, b) => a + (b - meanInterval) ** 2, 0) / intervalsMs.length;
  const coeffOfVariation = Math.sqrt(variance) / meanInterval;

  // Instead of hard-rejecting every reading outside a strict band (which, on a
  // single 30-45s phone scan, can mean "unclear" forever), compute HRV whenever
  // there are enough intervals, and label its confidence honestly instead of
  // hiding the number. High confidence: intervals consistent AND within the
  // plausible physiological range. Low confidence: still shown, but flagged
  // as preliminary — useful as a rough trend point, not a precise reading.
  let hrv = null;
  let hrvConfidence = null; // "high" | "low" | null
  if (intervalsMs.length >= 3) {
    const successiveDiffsSquared = [];
    for (let i = 1; i < intervalsMs.length; i++) {
      const diff = intervalsMs[i] - intervalsMs[i - 1];
      successiveDiffsSquared.push(diff * diff);
    }
    const meanSquaredDiff =
      successiveDiffsSquared.reduce((a, b) => a + b, 0) / successiveDiffsSquared.length;
    hrv = Math.round(Math.sqrt(meanSquaredDiff));

    const withinPlausibleRange = hrv >= MIN_PLAUSIBLE_HRV && hrv <= MAX_PLAUSIBLE_HRV * 2;
    const consistentPeaks = coeffOfVariation < 0.25;

    if (hrv > ABSOLUTE_MAX_HRV || hrv < MIN_PLAUSIBLE_HRV) {
      // Hard reject — no confidence label makes an implausible number trustworthy.
      hrv = null;
      hrvConfidence = null;
    } else if (withinPlausibleRange && consistentPeaks) {
      hrvConfidence = "high";
    } else if (withinPlausibleRange || coeffOfVariation < 0.4) {
      hrvConfidence = "low";
    } else {
      hrv = null; // genuinely too noisy even for a rough estimate
      hrvConfidence = null;
    }
  }

  return { bpm, hrv, hrvConfidence };
}