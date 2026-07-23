import { useState, useRef, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import "./VitalCheckScreen.css";

const SCAN_SECONDS = 30;
const SAMPLE_HZ = 30; // approx frame sampling rate we aim for
const MIN_BPM = 40;
const MAX_BPM = 180;

export default function VitalCheckScreen({ userId, onClose }) {
  const [phase, setPhase] = useState("intro"); // intro | scanning | result | error
  const [progress, setProgress] = useState(0);
  const [bpm, setBpm] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const samplesRef = useRef([]); // { t, value }
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
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

    function tick() {
      const elapsed = (performance.now() - startTimeRef.current) / 1000;

      if (elapsed >= SCAN_SECONDS) {
        finishScan();
        return;
      }
      if (video.readyState < 2) {
  rafRef.current = requestAnimationFrame(tick);
  return;
}

      ctx.drawImage(video, 0, 0, w, h);
      const frame = ctx.getImageData(0, 0, w, h).data;

      // Average the red channel across the sampled region — the fingertip-over-camera
      // method reads red-channel absorption changes from blood volume pulses.
      let sum = 0;
      const pixelCount = frame.length / 4;
      for (let i = 0; i < frame.length; i += 4) {
        sum += frame[i]; // red channel
      }
      const avgRed = sum / pixelCount;

      samplesRef.current.push({ t: elapsed, value: avgRed });
      setProgress(Math.min(100, Math.round((elapsed / SCAN_SECONDS) * 100)));

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
  }

  function finishScan() {
    stopCamera();
    const result = computeBpm(samplesRef.current);

    if (result === null) {
      setErrorMsg("Couldn't get a clear reading. Make sure your fingertip fully covers the camera and hold still.");
      setPhase("error");
      return;
    }

    setBpm(result);
    setPhase("result");
    saveReading(result);
  }

  async function saveReading(bpmValue) {
    if (!userId) return;
    try {
      const { data: vitalRow, error: vitalErr } = await supabase
        .from("vital_checks")
        .insert({ user_id: userId, bpm: bpmValue })
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
        value: { bpm: bpmValue, vital_check_id: vitalRow.id },
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

        {(phase === "scanning" || phase === "error" || phase === "result") && (
          <video ref={videoRef} className="vc-video-preview" playsInline muted />
        )}
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
 * Detrend + peak-detection heart rate estimator.
 * No external DSP libraries — deliberately dependency-free.
 *
 * 1. Resample the (irregularly-timed, requestAnimationFrame-driven) samples
 *    onto a fixed-rate grid.
 * 2. Detrend by subtracting a rolling average (removes lighting drift/baseline wander).
 * 3. Find peaks with a minimum-distance constraint matching MAX_BPM.
 * 4. Average the peak-to-peak intervals -> BPM.
 */
function computeBpm(samples) {
  if (samples.length < SAMPLE_HZ * 5) return null; // too little data

  const duration = samples[samples.length - 1].t;
  const gridSize = Math.floor(duration * SAMPLE_HZ);
  if (gridSize < SAMPLE_HZ * 5) return null;

  const grid = new Array(gridSize).fill(null);
  for (const s of samples) {
    const idx = Math.min(gridSize - 1, Math.round(s.t * SAMPLE_HZ));
    grid[idx] = s.value;
  }
  // Fill any gaps by carrying the previous value forward.
  let last = grid.find((v) => v !== null) ?? 0;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === null) grid[i] = last;
    else last = grid[i];
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

  // Peak detection with a minimum distance matching MAX_BPM (no two peaks closer
  // than the fastest physiologically plausible heartbeat).
  const minDistance = Math.round((60 / MAX_BPM) * SAMPLE_HZ);
  const peaks = [];
  for (let i = 1; i < detrended.length - 1; i++) {
    if (
      detrended[i] > detrended[i - 1] &&
      detrended[i] > detrended[i + 1] &&
      detrended[i] > 0
    ) {
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDistance) {
        peaks.push(i);
      }
    }
  }

  if (peaks.length < 4) return null; // not enough clean peaks for a confident reading

  const intervals = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i - 1]);
  }
  const avgIntervalFrames = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const avgIntervalSeconds = avgIntervalFrames / SAMPLE_HZ;
  const bpm = Math.round(60 / avgIntervalSeconds);

  if (bpm < MIN_BPM || bpm > MAX_BPM) return null;
  return bpm;
}