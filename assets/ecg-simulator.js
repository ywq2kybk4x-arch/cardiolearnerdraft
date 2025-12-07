// ECG vertical scaling (physiologic)
const MM_PER_MV = 10;
const PX_PER_MM_Y = 3; // adjust so 5 mm ≈ one big box height on your grid
const MV_TO_PX = MM_PER_MV * PX_PER_MM_Y;

// Physiologic amplitudes
const AMP_P_MV = 0.15;
const AMP_QRS_MV = 1.0;
const AMP_T_MV = 0.4;

const AMP_P_PX = AMP_P_MV * MV_TO_PX;
const AMP_QRS_PX = AMP_QRS_MV * MV_TO_PX;
const AMP_T_PX = AMP_T_MV * MV_TO_PX;

// Physiologic-ish QT limits
const QT_MIN_MS = 300;
const QT_MAX_MS = 600;

class EcgSimulator {
  constructor(backgroundCanvas, traceCanvas, config = {}) {
    this.backgroundCanvas = backgroundCanvas;
    this.traceCanvas = traceCanvas;
    this.backgroundCtx = backgroundCanvas.getContext('2d');
    this.traceCtx = traceCanvas.getContext('2d');

    this.pixelPerMm = PX_PER_MM_Y;
    this.sampleIntervalMs = 6;

    this.config = {
      displayTime: config.displayTime || 5,
      heartRate: config.heartRate || 75,
      speed: config.speed || 25 // 25 or 50 mm/s
    };

    this.highlights = { P: false, QRS: false, T: false };
    this.isPlaying = false;
    this.simulatedTimeMs = 0;
    this.lastFrameTime = 0;

    // Beat + sweep state
    this.beatDurationMs = 60000 / this.config.heartRate;
    this.beatSamples = [];
    this.sweepStartTime = 0; // where the current left-edge sweep window begins

    // Physiologic intervals (ms) and durations (ms)
    this.intervals = {
      prIntervalMs: 160,
      qrsDurationMs: 90,
      qtIntervalMs: 400,
      pWaveDurationMs: 90,
      tWaveDurationMs: 180
    };
    this.currentRhythm = 'sinus';
    this.beatSchedule = [];
    this.atrialSchedule = [];
    this.rhythmDurationMs = 8000;
    this.waveAmpsPx = {
      p: AMP_P_PX,
      q: -AMP_QRS_PX * 0.25,
      r: AMP_QRS_PX,
      s: -AMP_QRS_PX * 0.35,
      t: AMP_T_PX
    };

    this.handleResize = this.handleResize.bind(this);
    this.tick = this.tick.bind(this);

    this.handleResize();
    window.addEventListener('resize', this.handleResize);

    this.regenerateRhythm();
    this.drawGrid();
    this.reset();
    this.play();
  }

  // ---------------------------
  // CONFIG / CONTROL METHODS
  // ---------------------------

  setHeartRate(bpm) {
    this.config.heartRate = bpm;
    this.regenerateRhythm();
    this.sweepStartTime = this.simulatedTimeMs;
  }

  setPRIntervalMs(ms) {
    this.intervals.prIntervalMs = Math.min(Math.max(ms, 80), 320);
    this.regenerateRhythm();
    this.sweepStartTime = this.simulatedTimeMs;
  }

  setQRSDurationMs(ms) {
    this.intervals.qrsDurationMs = Math.min(Math.max(ms, 60), 200);
    this.regenerateRhythm();
    this.sweepStartTime = this.simulatedTimeMs;
  }

  setQTIntervalMs(ms) {
    this.intervals.qtIntervalMs = Math.min(Math.max(ms, QT_MIN_MS), QT_MAX_MS);
    this.regenerateRhythm();
    this.sweepStartTime = this.simulatedTimeMs;
  }

  setRhythm(rhythm) {
    this.currentRhythm = rhythm;
    this.regenerateRhythm();
    this.sweepStartTime = this.simulatedTimeMs;
  }

  setDisplayTime(seconds) {
    this.config.displayTime = Math.max(1, seconds);
    this.sweepStartTime = this.simulatedTimeMs;
  }

  setSpeed(mmPerSecond) {
    this.config.speed = mmPerSecond === 50 ? 50 : 25;
    this.sweepStartTime = this.simulatedTimeMs;
  }

  setHighlights(highlightConfig) {
    this.highlights = { ...this.highlights, ...highlightConfig };
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lastFrameTime = 0;
    requestAnimationFrame(this.tick);
  }

  pause() {
    this.isPlaying = false;
  }

  reset() {
    this.simulatedTimeMs = 0;
    this.sweepStartTime = 0;
    this.drawTrace();
  }

  // ---------------------------
  // CORE ANIMATION LOOP
  // ---------------------------

  tick(timestamp) {
    if (!this.isPlaying) return;

    if (!this.lastFrameTime) {
      this.lastFrameTime = timestamp;
    }

    const dt = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;

    this.simulatedTimeMs += dt;

    this.drawTrace();
    requestAnimationFrame(this.tick);
  }

  // ---------------------------
  // SMOOTH BEAT DEFINITION
  // ---------------------------

  generateBeat() {
    this.beatDurationMs = 60000 / this.config.heartRate;
    this.regenerateRhythm();
  }

  getCyclePhases(heartRate) {
    const RR = 60 / heartRate; // seconds per beat
    const pDur = this.intervals.pWaveDurationMs / 1000;
    const qrsDur = this.intervals.qrsDurationMs / 1000;
    const qtDur = this.intervals.qtIntervalMs / 1000;
    const prInt = this.intervals.prIntervalMs / 1000;
    const tDur = this.intervals.tWaveDurationMs / 1000;

    // Anchor P wave so there’s some flat baseline before it
    const pStartSec = 0.15 * RR; // 15% into cycle
    const pEndSec = pStartSec + pDur;

    // PR interval is P onset -> QRS onset
    const qrsStartSec = pStartSec + prInt;
    const qrsEndSec = qrsStartSec + qrsDur;

    // QT interval is QRS start -> T end
    const tEndSec = qrsStartSec + qtDur;

    // Start T near the end of ST; ensure T finishes at tEndSec
    const minST = 0.06; // 60 ms ST floor
    const tStartSec = Math.max(qrsEndSec + minST, tEndSec - tDur);

    return {
      RR,
      pStartSec,
      pEndSec,
      qrsStartSec,
      qrsEndSec,
      tStartSec,
      tEndSec
    };
  }

  // Smooth single bump: 0 → peak → 0 with curved edges
  smoothBump(t, start, duration, amp) {
    if (t < start || t > start + duration) return 0;
    const phase = (t - start) / duration; // 0 → 1
    return amp * Math.sin(Math.PI * phase);
  }

  // P wave: smooth low-amplitude hump (normal 0.1–0.2 mV, 80–100 ms)
  pWave(t, phases) {
    return this.smoothBump(t, phases.pStartSec, this.intervals.pWaveDurationMs / 1000, ECG_NORMAL.p.amp);
  }

  // T wave: broader smooth hump (normal 0.2–0.4 mV, ~160–200 ms)
  tWave(t, phases) {
    return this.smoothBump(t, phases.tStartSec, this.intervals.tWaveDurationMs / 1000, ECG_NORMAL.t.amp);
  }

  qrsComplex(t, phases) {
    const { qrsStartSec } = phases;
    const dur = this.intervals.qrsDurationMs / 1000;

    const qDur = dur * 0.25;
    const rDur = dur * 0.35;
    const sDur = dur * 0.25;

    const qStart = qrsStartSec;
    const rStart = qStart + qDur * 0.6;
    const sStart = rStart + rDur * 0.6;

    const q = this.smoothBump(t, qStart, qDur, ECG_NORMAL.qrs.qAmp);
    const r = this.smoothBump(t, rStart, rDur, ECG_NORMAL.qrs.rAmp);
    const s = this.smoothBump(t, sStart, sDur, ECG_NORMAL.qrs.sAmp);

    return q + r + s;
  }

  getVoltageAtTime(tGlobalSec) {
    return this.getVoltageAtTimeMs(tGlobalSec * 1000);
  }

  getWaveType(mV) {
    // Approximate wave categorization for coloring using pixel amplitudes
    const abs = Math.abs(mV);
    if (abs >= AMP_QRS_PX * 0.7) return 'QRS';
    if (abs >= AMP_P_PX * 0.6) return mV > 0 ? 'P' : 'T';
    return 'BASE';
  }

  waveTypeAtTime(tMs) {
    const duration = this.rhythmDurationMs || 8000;
    const time = ((tMs % duration) + duration) % duration;
    let closest = { type: 'BASE', dist: Infinity };

    const consider = (type, center, window) => {
      const dist = Math.abs(time - center);
      if (dist < window && dist < closest.dist) {
        closest = { type, dist };
      }
    };

    if (this.currentRhythm === 'avb3') {
      for (const p of this.atrialSchedule) {
        consider('P', p.pTime, p.width);
      }
    } else {
      for (const beat of this.beatSchedule) {
        if (!beat.hasP) continue;
        const pCenter = beat.rTime - beat.pr + 40;
        consider('P', pCenter, 90);
      }
    }

    for (const beat of this.beatSchedule) {
      if (beat.hasQRS) {
        consider('QRS', beat.rTime, beat.qrs);
        const tCenter = beat.rTime + beat.qt * 0.6;
        consider('T', tCenter, beat.qt * 0.25);
      }
    }

    return closest.type;
  }

  // ---------------------------
  // INTERPOLATED SAMPLING
  // ---------------------------

  sampleAtPhase(phaseMs) {
    const s = this.beatSamples;
    const n = s.length;
    if (!n) return { v: 0, type: 'BASE' };

    if (phaseMs <= s[0].t) return { v: s[0].v, type: s[0].type };
    if (phaseMs >= s[n - 1].t) return { v: s[n - 1].v, type: s[n - 1].type };

    // binary search
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (s[mid].t > phaseMs) hi = mid;
      else lo = mid;
    }

    const a = s[lo];
    const b = s[hi];
    const t = (phaseMs - a.t) / (b.t - a.t || 1);
    const v = a.v + t * (b.v - a.v);
    const type = t < 0.5 ? a.type : b.type;

    return { v, type };
  }

  sampleAtTime(timeMs) {
    const d = this.beatDurationMs || (60000 / this.config.heartRate);
    const phaseMs = ((timeMs % d) + d) % d; // wrap into 0–d
    return this.sampleAtPhase(phaseMs);
  }

  // ---------------------------
  // SWEEP-STYLE DRAWING
  // ---------------------------

  drawTrace() {
    const ctx = this.traceCtx;
    const canvas = this.traceCanvas;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const midY = h * 0.5;
    // Shift trace upward to visually center within padded container
    const verticalOffset = -60; // tweak between -55 and -70 if needed

    // Real-time mapping: ms per pixel based on true paper speed
    const msPerPixel = 1000 / (this.config.speed * this.pixelPerMm); // e.g., 25 mm/s => 150 px per second
    const windowMs = w * msPerPixel;

    // If we've completed a sweep, start over from the left
    let elapsedInSweep = this.simulatedTimeMs - this.sweepStartTime;
    if (elapsedInSweep >= windowMs || elapsedInSweep < 0) {
      this.sweepStartTime = this.simulatedTimeMs;
      elapsedInSweep = 0;
    }

    const sweepProgress = Math.min(elapsedInSweep / windowMs, 1);
    const xMax = Math.max(1, Math.floor(sweepProgress * (w - 1)));

    // Sample first point at left edge
    const mV0 = this.getVoltageAtTimeMs(this.sweepStartTime);
    let prevX = 0;
    let prevY = midY + verticalOffset - mV0;
    let prevType = this.waveTypeAtTime(this.sweepStartTime);

    ctx.beginPath();
    ctx.strokeStyle = this.colorForWave(prevType);
    ctx.moveTo(prevX, prevY);

    // Draw ONLY up to the sweep head (xMax)
    for (let x = 1; x <= xMax; x++) {
      const tMs = this.sweepStartTime + x * msPerPixel;
      const mV = this.getVoltageAtTimeMs(tMs);
      const y = midY + verticalOffset - mV;
      const type = this.waveTypeAtTime(tMs);

      if (type !== prevType) {
        ctx.lineTo(x, y);
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = this.colorForWave(type);
        ctx.moveTo(x, y);
        prevType = type;
      } else {
        ctx.lineTo(x, y);
      }

      prevX = x;
      prevY = y;
    }

    ctx.stroke();

    // Sweep marker at the front
    ctx.save();
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xMax + 0.5, 0);
    ctx.lineTo(xMax + 0.5, h);
    ctx.stroke();
    ctx.restore();
  }

  // ---------------------------
  // EXISTING METHODS
  // ---------------------------

  handleResize() {
    const dpr = window.devicePixelRatio || 1;
    const width = this.traceCanvas.clientWidth;
    const height = this.traceCanvas.clientHeight;
    this.renderWidth = width;
    this.renderHeight = height;

    [this.backgroundCanvas, this.traceCanvas].forEach((canvas) => {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    });

    this.drawGrid();
    this.drawTrace();
  }

  drawGrid() {
    const ctx = this.backgroundCtx;
    const canvas = this.backgroundCanvas;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const px = this.pixelPerMm;
    const big = px * 5;
    const dpr = window.devicePixelRatio || 1;

    // ---------- Small grid (1 mm) ----------
    ctx.strokeStyle = 'rgba(255, 180, 180, 0.25)';
    ctx.lineWidth = 0.7 * dpr;

    ctx.beginPath();
    for (let x = 0; x < w; x += px) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
    }
    for (let y = 0; y < h; y += px) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
    }
    ctx.stroke();

    // ---------- Large grid (5 mm) ----------
    ctx.strokeStyle = 'rgba(255, 120, 120, 0.45)';  // subtle large boxes
    ctx.lineWidth = 1.2 * dpr;

    ctx.beginPath();
    for (let x = 0; x < w; x += big) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
    }
    for (let y = 0; y < h; y += big) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
    }
    ctx.stroke();
  }

  colorForWave(waveType) {
    const base = '#1f2937';
    const highlightMap = { P: '#2563eb', QRS: '#d33f49', T: '#2f855a' };
    if (this.highlights[waveType]) return highlightMap[waveType] || base;
    return base;
  }

  // ---------------------------
  // Rhythm generation
  // ---------------------------

  regenerateRhythm() {
    this.beatSchedule = [];
    this.atrialSchedule = [];

    const durationMs = 8000;
    const baseRrMs = 60000 / this.config.heartRate;

    switch (this.currentRhythm) {
      case 'avb1':
        this.generateFirstDegreeAVBlock(durationMs, baseRrMs);
        break;
      case 'avb2_mobitz1':
        this.generateSecondDegreeMobitzI(durationMs, baseRrMs);
        break;
      case 'avb2_mobitz2':
        this.generateSecondDegreeMobitzII(durationMs, baseRrMs);
        break;
      case 'avb3':
        this.generateThirdDegreeAVBlock(durationMs);
        break;
      case 'afib':
        this.generateAFib(durationMs);
        break;
      case 'vtach':
        this.generateVTach(durationMs);
        break;
      case 'sinus':
      default:
        this.generateSinusRhythm(durationMs, baseRrMs);
        break;
    }

    const lastBeat = this.beatSchedule[this.beatSchedule.length - 1];
    this.rhythmDurationMs = lastBeat ? Math.max(durationMs, lastBeat.rTime + baseRrMs) : durationMs;
    this.drawTrace();
  }

  addBeat({ rTime, hasP = true, hasQRS = true, pr = this.intervals.prIntervalMs, qrs = this.intervals.qrsDurationMs, qt = this.intervals.qtIntervalMs }) {
    this.beatSchedule.push({ rTime, hasP, hasQRS, pr, qrs, qt });
  }

  generateSinusRhythm(durationMs, baseRrMs) {
    let t = 0;
    while (t < durationMs) {
      this.addBeat({
        rTime: t + this.intervals.prIntervalMs + this.intervals.qrsDurationMs / 2,
        hasP: true,
        hasQRS: true,
        pr: this.intervals.prIntervalMs,
        qrs: this.intervals.qrsDurationMs,
        qt: this.intervals.qtIntervalMs
      });
      t += baseRrMs;
    }
  }

  generateFirstDegreeAVBlock(durationMs, baseRrMs) {
    const longPr = Math.max(this.intervals.prIntervalMs, 240);
    let t = 0;
    while (t < durationMs) {
      this.addBeat({
        rTime: t + longPr + this.intervals.qrsDurationMs / 2,
        hasP: true,
        hasQRS: true,
        pr: longPr,
        qrs: this.intervals.qrsDurationMs,
        qt: this.intervals.qtIntervalMs
      });
      t += baseRrMs;
    }
  }

  generateSecondDegreeMobitzI(durationMs, baseRrMs) {
    const pr1 = 200;
    const pr2 = 260;
    const pr3 = 320;

    let t = 0;
    while (t < durationMs) {
      this.addBeat({
        rTime: t + pr1 + this.intervals.qrsDurationMs / 2,
        hasP: true,
        hasQRS: true,
        pr: pr1,
        qrs: this.intervals.qrsDurationMs,
        qt: this.intervals.qtIntervalMs
      });
      t += baseRrMs;

      if (t >= durationMs) break;
      this.addBeat({
        rTime: t + pr2 + this.intervals.qrsDurationMs / 2,
        hasP: true,
        hasQRS: true,
        pr: pr2,
        qrs: this.intervals.qrsDurationMs,
        qt: this.intervals.qtIntervalMs
      });
      t += baseRrMs;

      if (t >= durationMs) break;
      this.addBeat({
        rTime: t + pr3 + this.intervals.qrsDurationMs / 2,
        hasP: true,
        hasQRS: true,
        pr: pr3,
        qrs: this.intervals.qrsDurationMs,
        qt: this.intervals.qtIntervalMs
      });
      t += baseRrMs;

      if (t >= durationMs) break;
      this.addBeat({
        rTime: t + pr3 + this.intervals.qrsDurationMs / 2,
        hasP: true,
        hasQRS: false,
        pr: pr3,
        qrs: this.intervals.qrsDurationMs,
        qt: this.intervals.qtIntervalMs
      });
      t += baseRrMs;
    }
  }

  generateSecondDegreeMobitzII(durationMs, baseRrMs) {
    const fixedPr = Math.max(this.intervals.prIntervalMs, 180);
    let t = 0;
    let beatIndex = 0;

    while (t < durationMs) {
      const conducted = beatIndex % 2 === 0;
      this.addBeat({
        rTime: t + fixedPr + this.intervals.qrsDurationMs / 2,
        hasP: true,
        hasQRS: conducted,
        pr: fixedPr,
        qrs: this.intervals.qrsDurationMs,
        qt: this.intervals.qtIntervalMs
      });
      t += baseRrMs;
      beatIndex++;
    }
  }

  generateThirdDegreeAVBlock(durationMs) {
    this.beatSchedule = [];
    this.atrialSchedule = [];

    const atrialRate = 80;
    const ventRate = 35;

    const atrialRrMs = 60000 / atrialRate;
    const ventRrMs = 60000 / ventRate;

    let tA = 0;
    while (tA < durationMs) {
      this.atrialSchedule.push({ pTime: tA, width: 80 });
      tA += atrialRrMs;
    }

    let tV = 0;
    while (tV < durationMs) {
      this.addBeat({
        rTime: tV,
        hasP: false,
        hasQRS: true,
        pr: 0,
        qrs: 160,
        qt: 420
      });
      tV += ventRrMs;
    }
  }

  generateAFib(durationMs) {
    this.beatSchedule = [];
    this.atrialSchedule = [];

    const meanRate = Math.max(this.config.heartRate, 90);
    const meanRrMs = 60000 / meanRate;

    let t = 0;
    while (t < durationMs) {
      const jitterFactor = 0.5 + Math.random();
      const rr = meanRrMs * jitterFactor;

      this.addBeat({
        rTime: t,
        hasP: false,
        hasQRS: true,
        pr: 0,
        qrs: this.intervals.qrsDurationMs,
        qt: this.intervals.qtIntervalMs
      });

      t += rr;
    }
  }

  generateVTach(durationMs) {
    this.beatSchedule = [];
    this.atrialSchedule = [];

    const vtRate = Math.max(this.config.heartRate, 160);
    const rrMs = 60000 / vtRate;

    let t = 0;
    while (t < durationMs) {
      this.addBeat({
        rTime: t,
        hasP: false,
        hasQRS: true,
        pr: 0,
        qrs: 160,
        qt: 300
      });
      t += rrMs;
    }
  }

  drawPWave(tMs, centerMs, widthMs) {
    const sigma = widthMs / 6;
    const delta = tMs - centerMs;
    return this.waveAmpsPx.p * Math.exp(-0.5 * Math.pow(delta / (sigma || 1), 2));
  }

  drawQRSComplex(tMs, rTime, qrsWidthMs) {
    const qCenter = rTime - qrsWidthMs * 0.25;
    const sCenter = rTime + qrsWidthMs * 0.25;
    const sigma = qrsWidthMs / 10;

    const q = this.waveAmpsPx.q * Math.exp(-0.5 * Math.pow((tMs - qCenter) / (sigma || 1), 2));
    const r = this.waveAmpsPx.r * Math.exp(-0.5 * Math.pow((tMs - rTime) / (sigma || 1), 2));
    const s = this.waveAmpsPx.s * Math.exp(-0.5 * Math.pow((tMs - sCenter) / (sigma || 1), 2));

    return q + r + s;
  }

  drawTWave(tMs, centerMs, widthMs) {
    const sigma = widthMs / 5;
    const delta = tMs - centerMs;
    return this.waveAmpsPx.t * Math.exp(-0.5 * Math.pow(delta / (sigma || 1), 2));
  }

  getVoltageAtTimeMs(tMs) {
    const duration = this.rhythmDurationMs || 8000;
    const time = ((tMs % duration) + duration) % duration;
    let y = 0;

    if (this.currentRhythm === 'avb3') {
      for (const p of this.atrialSchedule) {
        if (Math.abs(time - p.pTime) <= p.width * 2) {
          y += this.drawPWave(time, p.pTime, p.width);
        }
      }
    } else {
      for (const beat of this.beatSchedule) {
        if (!beat.hasP) continue;
        const pCenter = beat.rTime - beat.pr + 40;
        if (Math.abs(time - pCenter) <= 160) {
          y += this.drawPWave(time, pCenter, 80);
        }
      }
    }

    for (const beat of this.beatSchedule) {
      if (beat.hasQRS && Math.abs(time - beat.rTime) <= beat.qrs * 2) {
        y += this.drawQRSComplex(time, beat.rTime, beat.qrs);
        const tCenter = beat.rTime + beat.qt * 0.6;
        y += this.drawTWave(time, tCenter, beat.qt * 0.3);
      }
    }

    if (this.currentRhythm === 'afib') {
      const fRate = 400;
      const omega = (2 * Math.PI * fRate) / 60000;
      y += AMP_P_PX * 0.4 * Math.sin(omega * time) + AMP_P_PX * 0.2 * (Math.random() - 0.5);
    }

    return y;
  }
}

window.EcgSimulator = EcgSimulator;
const ECG_NORMAL = {
  mmPerMv: MM_PER_MV, // standard ECG calibration
  p: { duration: 0.09, amp: AMP_P_MV }, // seconds, mV
  pr: { interval: 0.16 }, // total PR interval
  qrs: { duration: 0.09, rAmp: AMP_QRS_MV, qAmp: -0.2, sAmp: -0.4 },
  st: { duration: 0.12 },
  t: { duration: 0.16, amp: AMP_T_MV },
  qt: { interval: 0.4 }
};

function secToPx(sec, speedMmPerSec, pxPerMm) {
  return sec * speedMmPerSec * pxPerMm;
}
