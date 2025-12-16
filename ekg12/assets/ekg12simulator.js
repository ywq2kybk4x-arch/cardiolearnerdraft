// MVP 12-lead ECG simulator built on the single-lead waveform model.
// This intentionally mirrors the existing sweep engine so it can evolve into a full VCG later.

const MM_PER_MV_12 = 10;
const PX_PER_MM_12 = 4;
const MV_TO_PX_12 = MM_PER_MV_12 * PX_PER_MM_12;
const DEG_TO_RAD_12 = Math.PI / 180;

function normLead(name) {
  return String(name || '')
    .trim()
    .toUpperCase();
}

function normalizeLeadConfig(config) {
  const normalized = {};
  for (const [leadName, cfg] of Object.entries(config || {})) {
    normalized[normLead(leadName)] = { ...cfg };
  }
  return normalized;
}

const CANONICAL_LEAD_LIST = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];
const CANONICAL_LEAD_KEYS = CANONICAL_LEAD_LIST.map((name) => normLead(name));
const LIMB_LEADS = CANONICAL_LEAD_KEYS.slice(0, 6);
const CHEST_LEAD_KEYS = CANONICAL_LEAD_KEYS.slice(6);

const LEADS_12 = [
  ['I', 'aVR', 'V1', 'V4'],
  ['II', 'aVL', 'V2', 'V5'],
  ['III', 'aVF', 'V3', 'V6']
];

const ALL_LEAD_KEYS = CANONICAL_LEAD_KEYS;

const LIMB_LEAD_ANGLES = {
  I: 0,
  II: 60,
  III: 120,
  AVR: -150,
  AVL: -30,
  AVF: 90
};

const LIMB_MIN_SCALE = 0.08;
const LIMB_PT_MIN_SCALE = 0.12;

const LIMB_LEAD_CONFIG = normalizeLeadConfig({
  I: { gain: 0.95, polarity: 1, offsetPx: 0 },
  II: { gain: 1.05, polarity: 1, offsetPx: 0 },
  III: { gain: 0.95, polarity: 1, offsetPx: 0 },
  AVR: { gain: 1.0, polarity: -1, offsetPx: 0 },
  AVL: { gain: 1.05, polarity: 1, offsetPx: 0 },
  AVF: { gain: 1.0, polarity: 1, offsetPx: 0 }
});

const PRECORDIAL_ORDER = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6'];
const PRECORDIAL_BASE_GAINS = normalizeLeadConfig({
  V1: { baseGain: 0.9, offsetPx: 0 },
  V2: { baseGain: 0.95, offsetPx: 0 },
  V3: { baseGain: 1.0, offsetPx: 0 },
  V4: { baseGain: 1.05, offsetPx: 0 },
  V5: { baseGain: 1.1, offsetPx: 0 },
  V6: { baseGain: 1.05, offsetPx: 0 }
});

const DEFAULT_LIMB_CONFIG = { gain: 1, polarity: 1, offsetPx: 0 };
const DEFAULT_PRECORDIAL_CONFIG = { baseGain: 1, offsetPx: 0 };

const AMP_PX = {
  P: 0.15 * MV_TO_PX_12,
  Q: -0.25 * MV_TO_PX_12,
  R: 1.0 * MV_TO_PX_12,
  S: -0.35 * MV_TO_PX_12,
  T: 0.4 * MV_TO_PX_12
};

const BASE_INTERVALS = {
  prIntervalMs: 160,
  qrsDurationMs: 90,
  qtIntervalMs: 400,
  pWaveDurationMs: 90,
  tWaveDurationMs: 180
};

const degWrap = (deg) => {
  let d = ((deg + 180) % 360 + 360) % 360;
  if (d > 180) d -= 360;
  return d;
};

const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);

const safeNonZero = (g, minAbs = 0.18) => {
  if (!Number.isFinite(g)) return minAbs;
  if (Math.abs(g) < minAbs) {
    const sign = g === 0 ? 1 : Math.sign(g);
    return sign * minAbs;
  }
  return g;
};

const lerp = (a, b, t) => a + (b - a) * t;
const TILE_BASELINE_SHIFT_PX = 16;
const GRID_TOP_PADDING_PX = 28;
const DEFAULT_HR_CLAMP = { min: 40, max: 180 };

const RHYTHM_PRESETS = {
  sinus: {
    id: 'sinus',
    label: 'Sinus Rhythm',
    defaultHR: 75,
    hrClamp: { min: 40, max: 180 },
    intervals: { prIntervalMs: 160, qrsDurationMs: 90, qtIntervalMs: 400, pWaveDurationMs: 90, tWaveDurationMs: 180 }
  },
  afib: {
    id: 'afib',
    label: 'Atrial Fibrillation',
    defaultHR: 110,
    hrClamp: { min: 90, max: 160 },
    intervals: { prIntervalMs: 0, qrsDurationMs: 90, qtIntervalMs: 380, pWaveDurationMs: 0, tWaveDurationMs: 180 }
  },
  avb1: {
    id: 'avb1',
    label: '1° AV Block',
    defaultHR: 70,
    hrClamp: { min: 40, max: 140 },
    intervals: { prIntervalMs: 260, qrsDurationMs: 90, qtIntervalMs: 410 }
  },
  avb2_mobitz1: {
    id: 'avb2_mobitz1',
    label: '2° AV Block (Mobitz I)',
    defaultHR: 65,
    hrClamp: { min: 40, max: 140 },
    intervals: { prIntervalMs: 200, qrsDurationMs: 90, qtIntervalMs: 410 }
  },
  avb2_mobitz2: {
    id: 'avb2_mobitz2',
    label: '2° AV Block (Mobitz II)',
    defaultHR: 60,
    hrClamp: { min: 35, max: 120 },
    intervals: { prIntervalMs: 190, qrsDurationMs: 110, qtIntervalMs: 420 }
  },
  avb3: {
    id: 'avb3',
    label: '3° AV Block',
    defaultHR: 35,
    hrClamp: { min: 30, max: 50 },
    intervals: { prIntervalMs: 0, qrsDurationMs: 160, qtIntervalMs: 420 }
  },
  mvtach: {
    id: 'mvtach',
    label: 'Monomorphic Ventricular Tachycardia',
    defaultHR: 180,
    hrClamp: { min: 150, max: 220 },
    intervals: { prIntervalMs: 0, qrsDurationMs: 160, qtIntervalMs: 440 }
  },
  pvtach: {
    id: 'pvtach',
    label: 'Polymorphic Ventricular Tachycardia',
    defaultHR: 210,
    hrClamp: { min: 170, max: 240 },
    intervals: { prIntervalMs: 0, qrsDurationMs: 190, qtIntervalMs: 460 }
  }
};

const RHYTHM_IDS_IN_ORDER = Object.keys(RHYTHM_PRESETS);

class Ecg12Simulator {
  constructor(
    {
      backgroundCanvas,
      traceCanvas,
      overlayCanvas,
      bigBackgroundCanvas,
      bigTraceCanvas,
      bigOverlayCanvas
    },
    config = {}
  ) {
    this.backgroundCanvas = backgroundCanvas;
    this.traceCanvas = traceCanvas;
    this.overlayCanvas = overlayCanvas;
    this.bigBackgroundCanvas = bigBackgroundCanvas;
    this.bigTraceCanvas = bigTraceCanvas;
    this.bigOverlayCanvas = bigOverlayCanvas;

    this.backgroundCtx = backgroundCanvas.getContext('2d');
    this.traceCtx = traceCanvas.getContext('2d');
    this.overlayCtx = overlayCanvas ? overlayCanvas.getContext('2d') : null;
    this.bigBackgroundCtx = bigBackgroundCanvas ? bigBackgroundCanvas.getContext('2d') : null;
    this.bigTraceCtx = bigTraceCanvas ? bigTraceCanvas.getContext('2d') : null;
    this.bigOverlayCtx = bigOverlayCanvas ? bigOverlayCanvas.getContext('2d') : null;

    this.scrollContainer = this.overlayCanvas ? this.overlayCanvas.parentElement : null;

    this.pixelPerMm = PX_PER_MM_12;
    this.viewScale = 1;

    this.config = {
      displayTime: config.displayTime || 10,
      heartRate: config.heartRate || 75,
      speed: 25
    };
    this.currentRhythm = this.normalizeRhythmId(config.rhythm || 'sinus');
    this.debugLeadModel = false;
    this.debugLeadModelOverlay = false;

    this.highlights = { P: false, QRS: false, T: false };
    this.intervalHighlights = { PR: false, QRSd: false, QT: false };
    this.axisMode = this.normalizeAxisMode(config.axisMode || 'normal');
    this.axisDeg = this.axisDegFromMode(this.axisMode);
    if (typeof config.axisDeg === 'number') {
      this.setAxisDegrees(config.axisDeg);
    }
    this.showCalibrationPulse = true;

    this.selectedLead = 'II';
    this.selectedLeadKey = normLead(this.selectedLead);
    this.hoverLead = null;

    this.isPlaying = false;
    this.simulatedTimeMs = 0;
    this.lastFrameTime = 0;
    this.sweepStartTime = 0;

    this.intervals = { ...BASE_INTERVALS };
    const initialPreset = this.getPresetForId(this.currentRhythm);
    if (initialPreset) {
      this.config.heartRate = this.clampHeartRate(initialPreset.defaultHR ?? this.config.heartRate, initialPreset);
      this.applyPresetIntervals(initialPreset);
    }
    this.topReadoutHeight = 36;

    this.beatSchedule = [];
    this.atrialSchedule = [];
    this.rhythmDurationMs = 10000;
    this.viewports = [];
    this._leadConfigChecked = false;
    this._sampleCache = new Map();

    this.handleResize = this.handleResize.bind(this);
    this.tick = this.tick.bind(this);

    this.handleResize();
    window.addEventListener('resize', this.handleResize);

    this.regenerateRhythm();
    this.drawGrid();
    this.drawBigGrid();
    this.reset();
  }

  setHeartRate(bpm) {
    const preset = this.getCurrentPreset();
    const clampedValue = this.clampHeartRate(bpm, preset);
    this.config.heartRate = clampedValue;
    this.regenerateRhythm();
    this.sweepStartTime = this.simulatedTimeMs;
    return clampedValue;
  }

  setRhythm(rhythm) {
    const normalized = this.normalizeRhythmId(rhythm);
    const preset = this.getPresetForId(normalized);
    if (!preset) {
      console.warn(`[Ecg12Simulator] Unknown rhythm "${rhythm}", defaulting to sinus.`);
    }
    this.currentRhythm = preset ? preset.id : 'sinus';
    const targetPreset = preset || this.getPresetForId('sinus');
    if (targetPreset) {
      this.config.heartRate = this.clampHeartRate(
        targetPreset.defaultHR ?? this.config.heartRate,
        targetPreset
      );
      this.applyPresetIntervals(targetPreset);
    }
    this.regenerateRhythm();
    this.sweepStartTime = this.simulatedTimeMs;
  }

  setHighlights(cfg) {
    this.highlights = { ...this.highlights, ...cfg };
  }

  setIntervalHighlights(cfg) {
    this.intervalHighlights = { ...this.intervalHighlights, ...cfg };
  }

  setAxisDegrees(deg) {
    const clamped = Math.max(-180, Math.min(180, typeof deg === 'number' ? deg : 0));
    if (this.axisDeg === clamped) return;
    this.axisDeg = clamped;
    this.axisMode = this.axisModeFromDeg(clamped);
    this.drawTrace();
    this.drawExpandedTrace();
  }

  setAxisMode(mode) {
    const normalized = this.normalizeAxisMode(mode);
    if (this.axisMode === normalized) return;
    this.axisMode = normalized;
    this.axisDeg = this.axisDegFromMode(normalized);
    this.drawTrace();
    this.drawExpandedTrace();
  }

  getAxisMode() {
    return this.axisMode;
  }

  normalizeAxisMode(mode) {
    switch ((mode || '').toLowerCase()) {
      case 'lad':
        return 'lad';
      case 'rad':
        return 'rad';
      case 'extreme':
        return 'extreme';
      case 'normal':
      default:
        return 'normal';
    }
  }

  axisDegFromMode(mode) {
    switch (this.normalizeAxisMode(mode)) {
      case 'lad':
        return -30;
      case 'rad':
        return 120;
      case 'extreme':
        return -120;
      case 'normal':
      default:
        return 60;
    }
  }

  axisModeFromDeg(deg) {
    const d = degWrap(deg);
    if (d >= 0 && d <= 90) return 'normal';
    if (d < 0 && d >= -90) return 'lad';
    if (d > 90 && d <= 180) return 'rad';
    return 'extreme';
  }

  normalizeRhythmId(id) {
    const key = String(id || '').toLowerCase();
    return RHYTHM_PRESETS[key] ? key : 'sinus';
  }

  getPresetForId(id) {
    const key = this.normalizeRhythmId(id);
    return RHYTHM_PRESETS[key];
  }

  getCurrentPreset() {
    return this.getPresetForId(this.currentRhythm);
  }

  getRhythmList() {
    return RHYTHM_IDS_IN_ORDER.map((id) => ({
      id,
      label: RHYTHM_PRESETS[id]?.label || id
    }));
  }

  getCurrentRhythm() {
    return this.currentRhythm;
  }

  getHeartRate() {
    return Math.round(this.config.heartRate);
  }

  getHeartRateClamp() {
    const preset = this.getCurrentPreset();
    return preset?.hrClamp || DEFAULT_HR_CLAMP;
  }

  clampHeartRate(value, preset = this.getCurrentPreset()) {
    const clampRange = preset?.hrClamp || DEFAULT_HR_CLAMP;
    const numeric = Number(value);
    const fallback = this.config.heartRate || clampRange.min;
    const target = Number.isFinite(numeric) ? numeric : fallback;
    return clamp(target, clampRange.min, clampRange.max);
  }

  getCurrentRrMs() {
    return 60000 / Math.max(10, this.config.heartRate || 60);
  }

  applyPresetIntervals(preset) {
    if (!preset) return;
    const intervals = preset.intervals || {};
    this.intervals = {
      prIntervalMs: intervals.prIntervalMs ?? BASE_INTERVALS.prIntervalMs,
      qrsDurationMs: intervals.qrsDurationMs ?? BASE_INTERVALS.qrsDurationMs,
      qtIntervalMs: intervals.qtIntervalMs ?? BASE_INTERVALS.qtIntervalMs,
      pWaveDurationMs: intervals.pWaveDurationMs ?? BASE_INTERVALS.pWaveDurationMs,
      tWaveDurationMs: intervals.tWaveDurationMs ?? BASE_INTERVALS.tWaveDurationMs
    };
  }

  setSelectedLead(leadId) {
    const key = normLead(leadId);
    if (!leadId || !ALL_LEAD_KEYS.includes(key)) return;
    this.selectedLead = leadId;
    this.selectedLeadKey = key;
    this.drawExpandedTrace();
  }

  getSelectedLead() {
    return this.selectedLead;
  }

  setHoverLead(leadId) {
    this.hoverLead = leadId;
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
    this.drawExpandedTrace();
  }

  tick(timestamp) {
    if (!this.isPlaying) return;
    if (!this.lastFrameTime) this.lastFrameTime = timestamp;
    const dt = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;
    this.simulatedTimeMs += dt;
    this.drawTrace();
    this.drawExpandedTrace();
    requestAnimationFrame(this.tick);
  }

  handleResize() {
    const dpr = window.devicePixelRatio || 1;
    const REQUIRED_MM = 250;
    const paperCssWidth = Math.round(REQUIRED_MM * this.pixelPerMm * this.viewScale);
    const containerCssWidth = this.scrollContainer ? this.scrollContainer.clientWidth : 0;
    const requiredCssWidth = Math.max(paperCssWidth, containerCssWidth);
    const mainHeight = this.traceCanvas.clientHeight || 320;
    const bigHeight = this.bigTraceCanvas ? (this.bigTraceCanvas.clientHeight || 220) : 220;

    const resizeCanvas = (canvas, height) => {
      if (!canvas) return;
      canvas.style.width = `${requiredCssWidth}px`;
      canvas.style.height = `${height}px`;
      canvas.width = Math.floor(requiredCssWidth * dpr);
      canvas.height = Math.floor(height * dpr);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resizeCanvas(this.backgroundCanvas, mainHeight);
    resizeCanvas(this.traceCanvas, mainHeight);
    resizeCanvas(this.overlayCanvas, mainHeight);
    resizeCanvas(this.bigBackgroundCanvas, bigHeight);
    resizeCanvas(this.bigTraceCanvas, bigHeight);
    resizeCanvas(this.bigOverlayCanvas, bigHeight);

    this.renderWidth = requiredCssWidth;
    this.renderHeight = mainHeight;
    this.bigRenderHeight = bigHeight;

    this.computeViewports();
    this.drawGrid();
    this.drawBigGrid();
    this.drawTrace();
    this.drawExpandedTrace();
  }

  computeViewports() {
    const cols = LEADS_12[0].length;
    const rows = LEADS_12.length;
    const gutter = 8;
    const w = this.renderWidth || (this.traceCanvas ? this.traceCanvas.clientWidth : 0);
    const h =
      (this.renderHeight || (this.traceCanvas ? this.traceCanvas.clientHeight : 0)) -
      this.topReadoutHeight;

    const tileWidth = (w - gutter * (cols + 1)) / cols;
    const tileHeight = (h - GRID_TOP_PADDING_PX - gutter * (rows + 1)) / rows;
    const viewports = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const leadLabel = LEADS_12[r][c];
        const x = gutter + c * (tileWidth + gutter);
        const y = this.topReadoutHeight + GRID_TOP_PADDING_PX + gutter + r * (tileHeight + gutter);
        viewports.push({
          leadLabel,
          leadKey: normLead(leadLabel),
          x,
          y,
          width: tileWidth,
          height: tileHeight
        });
      }
    }

    this.viewports = viewports;
  }

  drawGrid() {
    if (!this.backgroundCtx) return;
    const ctx = this.backgroundCtx;
    const width = this.renderWidth || this.backgroundCanvas.clientWidth || 0;
    const height = this.renderHeight || this.backgroundCanvas.clientHeight || 0;
    ctx.clearRect(0, 0, width, height);
    this.drawGridOnCanvas(ctx, width, height);
  }

  drawBigGrid() {
    if (!this.bigBackgroundCtx || !this.bigBackgroundCanvas) return;
    const ctx = this.bigBackgroundCtx;
    const width = this.bigBackgroundCanvas.clientWidth || this.renderWidth || 0;
    const height = this.bigBackgroundCanvas.clientHeight || this.bigRenderHeight || 0;
    ctx.clearRect(0, 0, width, height);
    this.drawGridOnCanvas(ctx, width, height);
  }

  drawGridOnCanvas(ctx, width, height) {
    ctx.clearRect(0, 0, width, height);
    const px = this.pixelPerMm;
    const big = px * 5;
    ctx.strokeStyle = 'rgba(255,180,180,0.25)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let x = 0; x < width; x += px) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
    }
    for (let y = 0; y < height; y += px) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,120,120,0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let x = 0; x < width; x += big) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
    }
    for (let y = 0; y < height; y += big) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
    }
    ctx.stroke();
  }

  drawTrace() {
    const ctx = this.traceCtx;
    if (!ctx) return;
    const w = this.renderWidth || this.traceCanvas.clientWidth || 0;
    const h = this.renderHeight || this.traceCanvas.clientHeight || 0;
    ctx.clearRect(0, 0, w, h);

    const pxPerMm = this.pixelPerMm;
    const msPerPixel = 1000 / (this.config.speed * pxPerMm);
    const windowMs = w * msPerPixel;
    let elapsedInSweep = this.simulatedTimeMs - this.sweepStartTime;
    if (elapsedInSweep >= windowMs || elapsedInSweep < 0) {
      this.sweepStartTime = this.simulatedTimeMs;
      elapsedInSweep = 0;
    }
    const sweepProgress = Math.min(elapsedInSweep / windowMs, 1);
    const xMax = Math.max(1, Math.floor(sweepProgress * (w - 1)));

    this.viewports.forEach((vp) => {
      const leadLabel = vp.leadLabel;
      const leadKey = vp.leadKey;
      ctx.save();
      ctx.beginPath();
      ctx.rect(vp.x, vp.y, vp.width, vp.height);
      ctx.clip();

      ctx.fillStyle = 'rgba(15,23,42,0.65)';
      ctx.font = '12px Arial';
      ctx.textBaseline = 'top';
      const labelX = vp.x + 6;
      const labelY = vp.y + 14;
      const labelPaddingX = 4;
      const labelPaddingY = 2;
      const labelHeight = 14;
      const labelWidth = ctx.measureText(leadLabel).width + labelPaddingX * 2;
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.strokeStyle = 'rgba(15,23,42,0.08)';
      ctx.beginPath();
      this.roundedRectPath(ctx, labelX - labelPaddingX, labelY - labelPaddingY, labelWidth, labelHeight, 4);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = 'rgba(15,23,42,0.8)';
      ctx.fillText(leadLabel, labelX, labelY);
      ctx.textBaseline = 'alphabetic';

      if (this.debugLeadModelOverlay) {
        const dbgGain = this.getLeadDebugGain(leadKey);
        ctx.fillStyle = 'rgba(30,41,59,0.65)';
        ctx.font = '10px "SFMono-Regular", monospace';
        ctx.fillText(`g=${dbgGain.toFixed(2)}`, vp.x + 6, vp.y + 18);
        ctx.fillStyle = 'rgba(15,23,42,0.65)';
        ctx.font = '12px Arial';
      }

      const baselineYRaw = vp.y + vp.height * 0.5 + TILE_BASELINE_SHIFT_PX;
      const baselineY = Math.max(vp.y + 18, Math.min(vp.y + vp.height - 18, baselineYRaw));
      ctx.strokeStyle = 'rgba(148,163,184,0.5)';
      ctx.beginPath();
      ctx.moveTo(vp.x, baselineY + 0.5);
      ctx.lineTo(vp.x + vp.width, baselineY + 0.5);
      ctx.stroke();

      const baseTime = this.sweepStartTime;
      const mV0 = this.getLeadVoltageAtTimeMs(baseTime, leadKey);
      let prevY = baselineY - mV0;
      let prevType = this.waveTypeAtTime(baseTime);
      ctx.beginPath();
      ctx.strokeStyle = this.colorForWave(prevType);
      ctx.moveTo(vp.x, prevY);

      for (let x = 1; x <= xMax; x++) {
        const canvasX = vp.x + x;
        if (canvasX > vp.x + vp.width) break;
        const tMs = baseTime + x * msPerPixel;
        const leadVal = this.getLeadVoltageAtTimeMs(tMs, leadKey);
        const waveType = this.waveTypeAtTime(tMs);
        const y = baselineY - leadVal;

        if (waveType !== prevType) {
          ctx.lineTo(canvasX, y);
          ctx.stroke();
          ctx.beginPath();
          ctx.strokeStyle = this.colorForWave(waveType);
          ctx.moveTo(canvasX, y);
          prevType = waveType;
        } else {
          ctx.lineTo(canvasX, y);
        }
        prevY = y;
      }

      ctx.stroke();

      ctx.strokeStyle = '#16a34a';
      ctx.beginPath();
      const sweepX = vp.x + Math.min(xMax, vp.width - 1) + 0.5;
      ctx.moveTo(sweepX, vp.y);
      ctx.lineTo(sweepX, vp.y + vp.height);
      ctx.stroke();
      ctx.restore();
    });
    this.drawReadoutOverlay();
  }

  drawExpandedTrace() {
    const ctx = this.bigTraceCtx;
    if (!ctx) return;
    const w = this.bigBackgroundCanvas ? this.bigBackgroundCanvas.clientWidth : this.renderWidth;
    const h = this.bigBackgroundCanvas ? this.bigBackgroundCanvas.clientHeight : this.bigRenderHeight;
    ctx.clearRect(0, 0, w, h);

    const pxPerMm = this.pixelPerMm;
    const msPerPixel = 1000 / (this.config.speed * pxPerMm);
    const windowMs = (this.renderWidth || w) * msPerPixel;
    let elapsedInSweep = this.simulatedTimeMs - this.sweepStartTime;
    if (elapsedInSweep >= windowMs || elapsedInSweep < 0) {
      this.sweepStartTime = this.simulatedTimeMs;
      elapsedInSweep = 0;
    }
    const sweepProgress = Math.min(elapsedInSweep / windowMs, 1);
    const xMax = Math.max(1, Math.floor(sweepProgress * ((this.renderWidth || w) - 1)));

    const baselineY = h * 0.45;
    const overlayBandHeight = 90;
    const overlayTopY = baselineY + overlayBandHeight * 0.4;
    const leadLabel = this.selectedLead;
    const leadKey = this.selectedLeadKey || normLead(leadLabel);

    const baseTime = this.sweepStartTime;
    let prevType = this.waveTypeAtTime(baseTime);
    ctx.beginPath();
    ctx.strokeStyle = this.colorForWave(prevType);
    ctx.moveTo(0, baselineY - this.getLeadVoltageAtTimeMs(baseTime, leadKey));

    for (let x = 1; x <= xMax; x++) {
      const tMs = baseTime + x * msPerPixel;
      const val = this.getLeadVoltageAtTimeMs(tMs, leadKey);
      const waveType = this.waveTypeAtTime(tMs);
      const y = baselineY - val;

      if (waveType !== prevType) {
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = this.colorForWave(waveType);
        ctx.moveTo(x, y);
        prevType = waveType;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    ctx.strokeStyle = '#16a34a';
    ctx.beginPath();
    ctx.moveTo(xMax + 0.5, 0);
    ctx.lineTo(xMax + 0.5, h);
    ctx.stroke();

    if (this.showCalibrationPulse) {
      this.drawCalibrationPulse(ctx, baselineY, msPerPixel, overlayTopY, h);
    }

    if (this.bigOverlayCtx) {
      this.bigOverlayCtx.clearRect(0, 0, w, h);
      this.drawIntervalOverlays(this.bigOverlayCtx, {
        tWindowStart: this.sweepStartTime,
        tWindowEnd: this.sweepStartTime + xMax * msPerPixel,
        xMax,
        msPerPixel,
        overlayTopY,
        overlayBandH: overlayBandHeight,
        midY: baselineY,
        verticalOffset: 0,
        plotTopY: 0,
        plotBottomY: overlayTopY,
        leadKey
      });
    }
  }

  drawIntervalOverlays(ctx, params) {
    const on = this.intervalHighlights;
    if (!on.PR && !on.QRSd && !on.QT) return;
    const {
      tWindowStart,
      tWindowEnd,
      xMax,
      msPerPixel,
      overlayTopY,
      overlayBandH,
      midY,
      verticalOffset,
      plotTopY,
      plotBottomY,
      leadKey
    } = params;
    const duration = this.rhythmDurationMs || 10000;
    const overlayLeadKey = leadKey || this.selectedLeadKey || normLead(this.selectedLead);
    const baselineY = midY + (verticalOffset || 0);
    const padTop = 14;
    const padBottom = 10;
    const usableH = Math.max(40, overlayBandH - padTop - padBottom);
    const laneGap = Math.floor(usableH / 3);
    const shiftedTop = overlayTopY;
    const lanes = {
      PR: shiftedTop + padTop + laneGap * 0.3,
      QRSd: shiftedTop + padTop + laneGap * 1.3,
      QT: shiftedTop + padTop + laneGap * 2.3
    };
    const style = {
      PR: { stroke: '#2563eb', fill: 'rgba(37,99,235,0.10)', label: (ms) => `PR ${ms} ms` },
      QRSd: { stroke: '#d33f49', fill: 'rgba(211,63,73,0.10)', label: (ms) => `QRS ${ms} ms` },
      QT: { stroke: '#2f855a', fill: 'rgba(47,133,90,0.10)', label: (ms) => `QT ${ms} ms` }
    };

    const waveformY = (tMs) => {
      const v = this.getLeadVoltageAtTimeMs(tMs, overlayLeadKey);
      const y = baselineY - v;
      const limitBottom = (plotBottomY || overlayTopY) - 2;
      return Math.max((plotTopY || 0) + 2, Math.min(limitBottom, y));
    };

    const drawGuides = (key, x1, x2, yTop, tStart, tEnd) => {
      ctx.save();
      ctx.strokeStyle = style[key].stroke;
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = 1.25;
      ctx.setLineDash([3, 3]);

      const y1 = waveformY(tStart);
      ctx.beginPath();
      ctx.moveTo(x1 + 0.5, yTop);
      ctx.lineTo(x1 + 0.5, y1);
      ctx.stroke();
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = style[key].stroke;
      ctx.lineWidth = 1.25;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x1 - 6, y1 + 0.5);
      ctx.lineTo(x1 + 6, y1 + 0.5);
      ctx.stroke();
      ctx.restore();

      const y2 = waveformY(tEnd);
      ctx.beginPath();
      ctx.moveTo(x2 + 0.5, yTop);
      ctx.lineTo(x2 + 0.5, y2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = style[key].stroke;
      ctx.beginPath();
      ctx.arc(x1 + 0.5, y1, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x2 + 0.5, y2, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = style[key].stroke;
      ctx.lineWidth = 1.25;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x2 - 6, y2 + 0.5);
      ctx.lineTo(x2 + 6, y2 + 0.5);
      ctx.stroke();
      ctx.restore();
      ctx.restore();
    };

    const drawBracket = (key, tStart, tEnd, label) => {
      const x1 = (tStart - tWindowStart) / msPerPixel;
      const x2 = (tEnd - tWindowStart) / msPerPixel;
      if (x2 < 0 || x1 > xMax) return;
      const xx1 = Math.max(0, Math.min(xMax, x1));
      const xx2 = Math.max(0, Math.min(xMax, x2));
      if (xx2 - xx1 <= 1) return;
      const y = lanes[key];
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = style[key].stroke;
      ctx.fillStyle = style[key].fill;
      ctx.beginPath();
      ctx.rect(xx1, y - 10, xx2 - xx1, 10);
      ctx.fill();
      ctx.stroke();
      ctx.font = '12px Arial';
      ctx.fillStyle = style[key].stroke;
      ctx.fillText(style[key].label(label), xx1, y - 22);
      ctx.restore();
      drawGuides(key, xx1, xx2, y - 10, tStart, tEnd);
    };

    for (const beat of this.beatSchedule) {
      if (!beat.hasQRS) continue;
      const t0 = beat.rTime;
      const kStart = Math.floor((tWindowStart - t0) / duration) - 1;
      const kEnd = Math.floor((tWindowEnd - t0) / duration) + 1;
      for (let k = kStart; k <= kEnd; k++) {
        const rOcc = t0 + k * duration;
        const qrsStart = rOcc - beat.qrs / 2;
        const qrsEnd = qrsStart + beat.qrs;
        const qtEnd = qrsStart + beat.qt;
        const prStart = qrsStart - beat.pr;

        if (on.PR && beat.hasP && beat.pr > 0) drawBracket('PR', prStart, qrsStart, Math.round(beat.pr));
        if (on.QRSd) drawBracket('QRSd', qrsStart, qrsEnd, Math.round(beat.qrs));
        if (on.QT) drawBracket('QT', qrsStart, qtEnd, Math.round(beat.qt));
      }
    }
  }

  drawReadoutOverlay() {
    if (!this.overlayCtx || !this.overlayCanvas) return;
    const ctx = this.overlayCtx;
    const w = this.renderWidth || this.overlayCanvas.clientWidth || 0;
    const h = this.renderHeight || this.overlayCanvas.clientHeight || 0;
    ctx.clearRect(0, 0, w, h);
    const summary = this.getReadoutSummary();
    const iv = this.getIntervalReadout();
    const lines = [
      summary.hrText,
      summary.axisText,
      `PR ${iv.prMs} ms`,
      `QRS ${iv.qrsMs} ms`,
      `QT ${iv.qtMs} ms`
    ];
    const sc = this.scrollContainer || this.overlayCanvas.parentElement;
    const scrollLeft = sc ? sc.scrollLeft : 0;
    const viewW = sc ? sc.clientWidth : w;
    const fontSize = 12;
    ctx.font = `${fontSize}px "SFMono-Regular", Consolas, monospace`;
    ctx.textBaseline = 'top';
    const padding = 8;
    const lineHeight = fontSize + 2;
    let maxWidth = 0;
    lines.forEach((line) => {
      maxWidth = Math.max(maxWidth, ctx.measureText(line).width);
    });
    const boxWidth = maxWidth + padding * 2;
    const boxHeight = lines.length * lineHeight + padding * 1.5;
    const margin = 12;
    const x = Math.max(margin, scrollLeft + viewW - boxWidth - margin);
    const y = 8;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    this.roundedRectPath(ctx, x, y, boxWidth, boxHeight, 8);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#0f172a';
    lines.forEach((line, i) => ctx.fillText(line, x + padding, y + padding + i * lineHeight));
  }

  getIntervalReadout() {
    return {
      prMs: Math.round(this.intervals.prIntervalMs),
      qrsMs: Math.round(this.intervals.qrsDurationMs),
      qtMs: Math.round(this.intervals.qtIntervalMs)
    };
  }

  roundedRectPath(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }

  drawCalibrationPulse(ctx, baselineY, msPerPixel, overlayTopY, canvasHeight) {
    const calWidthMs = 200;
    const calHeightPx = MV_TO_PX_12;
    const calWidthPx = Math.max(4, calWidthMs / (msPerPixel || 1));
    const xStart = 12;
    const baseY = Math.min(canvasHeight - 20, overlayTopY - 10);
    ctx.save();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(xStart, baseY);
    ctx.lineTo(xStart, baseY - calHeightPx);
    ctx.lineTo(xStart + calWidthPx, baseY - calHeightPx);
    ctx.lineTo(xStart + calWidthPx, baseY);
    ctx.stroke();
    ctx.restore();
  }

  colorForWave(type) {
    const base = '#1f2937';
    if (this.highlights[type]) {
      const map = { P: '#2563eb', QRS: '#d33f49', T: '#2f855a' };
      return map[type] || base;
    }
    return base;
  }

  getLeadAtEvent(event) {
    const rect = this.traceCanvas.getBoundingClientRect();
    const scaleX = (this.renderWidth || rect.width) / rect.width;
    const scaleY = (this.renderHeight || rect.height) / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    return this.getLeadAtPoint(x, y);
  }

  getLeadAtPoint(x, y) {
    for (const vp of this.viewports) {
      if (x >= vp.x && x <= vp.x + vp.width && y >= vp.y && y <= vp.y + vp.height) {
        return vp.leadLabel;
      }
    }
    return null;
  }

  getReadoutSummary() {
    const axisMode = this.axisMode || 'normal';
    const axisLabelMap = {
      normal: 'Normal Axis (0° to +90°)',
      lad: 'Left Axis Deviation (0° to −90°)',
      rad: 'Right Axis Deviation (+90° to +180°)',
      extreme: 'Extreme Axis (−90° to −180°)'
    };
    const axisLabel = axisLabelMap[axisMode] || axisLabelMap.normal;
    return {
      hrText: `HR ${Math.round(this.config.heartRate)} bpm`,
      axisText: `Axis: ${axisLabel}`
    };
  }

  ensureLeadSanityChecked() {
    if (this._leadConfigChecked) return;
    this._leadConfigChecked = true;
    this.verifyLeadConfiguration();
  }

  verifyLeadConfiguration() {
    const unique = ALL_LEAD_KEYS;
    console.log('[Ecg12Simulator] Lead set:', CANONICAL_LEAD_LIST.join(', '));
    console.log('[Ecg12Simulator] Layout order:', LEADS_12.flat().join(', '));
    const hasV3 = unique.includes(normLead('V3'));
    const hasV6 = unique.includes(normLead('V6'));
    console.assert(hasV3, '[Ecg12Simulator] Lead configuration is missing V3.');
    console.assert(hasV6, '[Ecg12Simulator] Lead configuration is missing V6.');
    const firstBeat = this.beatSchedule[0];
    if (firstBeat) {
      const sample = Math.abs(this.getLeadValueAtTimeMs(firstBeat.rTime + 5, 'V3'));
      console.assert(sample > 1e-2, '[Ecg12Simulator] Lead V3 appears nearly flat; check configuration.', sample);
    }
  }

  regenerateRhythm() {
    const preset = this.getCurrentPreset();
    const durationMs = (this.config.displayTime || 10) * 1000;
    this.atrialSchedule = [];
    this.beatSchedule = this.buildBeatSchedule(preset, durationMs);
    const lastBeat = this.beatSchedule[this.beatSchedule.length - 1];
    const baseRrMs = this.getCurrentRrMs();
    this.rhythmDurationMs = lastBeat
      ? Math.max(durationMs, lastBeat.rTime + baseRrMs)
      : durationMs;
    this._sampleCache.clear();
    this.drawTrace();
    this.drawExpandedTrace();
    this.ensureLeadSanityChecked();
  }

  buildBeatSchedule(preset, durationMs) {
    const schedule = [];
    const activePreset = preset || this.getPresetForId('sinus');
    const id = activePreset?.id || 'sinus';
    switch (id) {
      case 'afib':
        this.generateAFibBeats(schedule, durationMs);
        break;
      case 'avb1':
        this.generateFirstDegreeBeats(schedule, durationMs);
        break;
      case 'avb2_mobitz1':
        this.generateMobitzIBeats(schedule, durationMs);
        break;
      case 'avb2_mobitz2':
        this.generateMobitzIIBeats(schedule, durationMs);
        break;
      case 'avb3':
        this.generateThirdDegreeBeats(schedule, durationMs);
        break;
      case 'mvtach':
        console.warn('[Ecg12Simulator] Monomorphic VT is approximated for the 12-lead view.');
        this.generateVentricularTachBeats(schedule, durationMs, { polymorphic: false });
        break;
      case 'pvtach':
        console.warn('[Ecg12Simulator] Polymorphic VT is approximated for the 12-lead view.');
        this.generateVentricularTachBeats(schedule, durationMs, { polymorphic: true });
        break;
      case 'sinus':
      default:
        this.generateSinusBeats(schedule, durationMs);
        break;
    }
    if (!schedule.length) {
      console.warn('[Ecg12Simulator] Rhythm schedule was empty; falling back to sinus.');
      this.generateSinusBeats(schedule, durationMs);
    }
    schedule.sort((a, b) => a.rTime - b.rTime);
    return schedule;
  }

  addBeatToSchedule(schedule, beat) {
    if (!beat || typeof beat.rTime !== 'number') return;
    const base = this.intervals;
    schedule.push({
      rTime: beat.rTime,
      hasP: beat.hasP !== undefined ? beat.hasP : true,
      hasQRS: beat.hasQRS !== undefined ? beat.hasQRS : true,
      hasT: beat.hasT !== undefined ? beat.hasT : true,
      pr: beat.pr != null ? beat.pr : base.prIntervalMs,
      qrs: beat.qrs != null ? beat.qrs : base.qrsDurationMs,
      qt: beat.qt != null ? beat.qt : base.qtIntervalMs,
      qrsScale: beat.qrsScale || 1,
      polarity: beat.polarity || 1
    });
  }

  generateSinusBeats(schedule, durationMs) {
    const baseRrMs = this.getCurrentRrMs();
    let cycleStart = 0;
    while (cycleStart < durationMs) {
      const rTime = cycleStart + this.intervals.prIntervalMs + this.intervals.qrsDurationMs / 2;
      this.addBeatToSchedule(schedule, { rTime });
      cycleStart += baseRrMs;
    }
  }

  generateFirstDegreeBeats(schedule, durationMs) {
    const baseRrMs = this.getCurrentRrMs();
    const longPr = Math.max(this.intervals.prIntervalMs, 240);
    let cycleStart = 0;
    while (cycleStart < durationMs) {
      const rTime = cycleStart + longPr + this.intervals.qrsDurationMs / 2;
      this.addBeatToSchedule(schedule, { rTime, pr: longPr });
      cycleStart += baseRrMs;
    }
  }

  generateMobitzIBeats(schedule, durationMs) {
    const baseRrMs = this.getCurrentRrMs();
    const pattern = [
      { pr: 200, conducted: true },
      { pr: 260, conducted: true },
      { pr: 320, conducted: true },
      { pr: 320, conducted: false }
    ];
    let cycleStart = 0;
    let idx = 0;
    while (cycleStart < durationMs) {
      const step = pattern[idx % pattern.length];
      const rTime = cycleStart + step.pr + this.intervals.qrsDurationMs / 2;
      this.addBeatToSchedule(schedule, {
        rTime,
        pr: step.pr,
        hasQRS: step.conducted
      });
      cycleStart += baseRrMs;
      idx++;
    }
  }

  generateMobitzIIBeats(schedule, durationMs) {
    const baseRrMs = this.getCurrentRrMs();
    let cycleStart = 0;
    let idx = 0;
    const fixedPr = Math.max(this.intervals.prIntervalMs, 180);
    while (cycleStart < durationMs) {
      const conducted = idx % 2 === 0;
      const rTime = cycleStart + fixedPr + this.intervals.qrsDurationMs / 2;
      this.addBeatToSchedule(schedule, {
        rTime,
        pr: fixedPr,
        hasQRS: conducted
      });
      cycleStart += baseRrMs;
      idx++;
    }
  }

  generateThirdDegreeBeats(schedule, durationMs) {
    const ventRate = clamp(this.config.heartRate, 30, 50);
    const ventRr = 60000 / ventRate;
    let ventTime = 0;
    while (ventTime < durationMs) {
      this.addBeatToSchedule(schedule, {
        rTime: ventTime,
        hasP: false,
        pr: 0,
        qrs: Math.max(this.intervals.qrsDurationMs, 160),
        qt: Math.max(this.intervals.qtIntervalMs, 420)
      });
      ventTime += ventRr;
    }
    const atrialRr = 60000 / 80;
    let atrialTime = 0;
    while (atrialTime < durationMs) {
      this.addBeatToSchedule(schedule, {
        rTime: atrialTime,
        hasP: true,
        hasQRS: false,
        pr: 140,
        qrs: this.intervals.qrsDurationMs,
        qt: this.intervals.qtIntervalMs
      });
      atrialTime += atrialRr;
    }
  }

  generateAFibBeats(schedule, durationMs) {
    const meanRr = 60000 / Math.max(this.config.heartRate, 90);
    let t = 0;
    let i = 0;
    while (t < durationMs) {
      const jitter = 0.65 + 0.7 * (0.5 + 0.5 * Math.sin(i * 1.7));
      const rr = Math.max(220, meanRr * jitter);
      const rTime = t + this.intervals.qrsDurationMs / 2;
      this.addBeatToSchedule(schedule, {
        rTime,
        hasP: false,
        pr: 0
      });
      t += rr;
      i++;
    }
  }

  generateVentricularTachBeats(schedule, durationMs, options = {}) {
    const { polymorphic } = options;
    const rr = 60000 / Math.max(this.config.heartRate, polymorphic ? 190 : 170);
    let t = 0;
    let i = 0;
    while (t < durationMs) {
      const rTime = t;
      const polarity = polymorphic ? (i % 2 === 0 ? 1 : -1) : 1;
      const qrsWidth = polymorphic ? 190 : 160;
      this.addBeatToSchedule(schedule, {
        rTime,
        hasP: false,
        pr: 0,
        qrs: qrsWidth,
        qt: Math.max(this.intervals.qtIntervalMs, 440),
        polarity,
        hasT: true
      });
      t += rr;
      i++;
    }
  }

  getLeadVoltageAtTimeMs(tMs, leadId) {
    return this.getLeadValueAtTimeMs(tMs, leadId);
  }

  getLeadValueAtTimeMs(tMs, leadId) {
    const key = normLead(leadId);
    const sample = this.getWaveSampleForLead(tMs, key);
    if (LIMB_LEADS.includes(key)) {
      return this.computeLimbLeadValue(key, sample);
    }
    return this.computePrecordialLeadValue(key, sample);
  }

  getWaveSampleForLead(tMs, leadKey) {
    const cacheKey = `${leadKey}|${tMs}`;
    if (this._sampleCache.has(cacheKey)) {
      return this._sampleCache.get(cacheKey);
    }
    const data = this.sampleWaveComponentsAtTime(tMs, leadKey);
    if (this._sampleCache.size > 2000) {
      this._sampleCache.clear();
    }
    this._sampleCache.set(cacheKey, data);
    return data;
  }

  computeLimbLeadValue(leadKey, sample) {
    const cfg = LIMB_LEAD_CONFIG[leadKey] || DEFAULT_LIMB_CONFIG;
    const pAxis = this.getWaveAxisDeg('P');
    const qrsAxis = this.getWaveAxisDeg('QRS');
    const tAxis = this.getWaveAxisDeg('T');
    const total =
      this.scaleLimbComponent(sample.P, leadKey, pAxis, 'P') +
      this.scaleLimbComponent(sample.QRS, leadKey, qrsAxis, 'QRS') +
      this.scaleLimbComponent(sample.T, leadKey, tAxis, 'T');
    return total * (cfg.gain || 1) * (cfg.polarity || 1) + (cfg.offsetPx || 0);
  }

  scaleLimbComponent(magnitude, leadKey, axisDeg, waveType) {
    if (!magnitude) return 0;
    const leadAngle = LIMB_LEAD_ANGLES[leadKey];
    if (typeof leadAngle !== 'number') return 0;
    const diff = degWrap(axisDeg - leadAngle);
    const minScale = waveType === 'QRS' ? LIMB_MIN_SCALE : LIMB_PT_MIN_SCALE;
    const scale = safeNonZero(Math.cos(diff * DEG_TO_RAD_12), minScale);
    if (this.debugLeadModel) {
      console.log(
        `[Ecg12Simulator][DEBUG] lead=${leadKey} wave=${waveType} axis=${axisDeg.toFixed(
          1
        )} diff=${diff.toFixed(1)} scale=${scale.toFixed(3)}`
      );
    }
    return magnitude * scale;
  }

  computePrecordialLeadValue(leadKey, sample) {
    const idx = PRECORDIAL_ORDER.indexOf(leadKey);
    if (idx === -1) {
      const msg = `[Ecg12Simulator] Unknown precordial lead "${leadKey}" requested.`;
      console.error(msg);
      throw new Error(msg);
    }
    const frac = PRECORDIAL_ORDER.length > 1 ? idx / (PRECORDIAL_ORDER.length - 1) : 0;
    const cfg = PRECORDIAL_BASE_GAINS[leadKey] || DEFAULT_PRECORDIAL_CONFIG;
    const qrsParts = sample.qrsParts || { q: 0, r: 0, s: 0 };

    const rWeight = clamp((idx - 1) / 4, 0, 1);
    const sWeight = 1 - rWeight;
    const qWeight = 0.15;

    const q = qrsParts.q * qWeight;
    const r = qrsParts.r * (0.35 + 0.95 * rWeight);
    const s = qrsParts.s * (0.35 + 1.0 * sWeight);
    const qrs = q + r + s;

    const pScale = lerp(0.9, 1.05, frac);
    const tScale = lerp(0.65, 1.2, frac);
    const pPart = sample.P * pScale;
    const tPart = sample.T * tScale;
    const ptComponent = (pPart + tPart) * (cfg.baseGain || 1);

    let value = qrs * (cfg.baseGain || 1) + ptComponent + (cfg.offsetPx || 0);

    if (leadKey === 'V1') value *= 0.95;
    else if (leadKey === 'V3') value *= 0.9;
    else if (leadKey === 'V5') value *= 1.05;

    if (this.debugLeadModel) {
      console.log(
        `[Ecg12Simulator][DEBUG] lead=${leadKey} idx=${idx} rW=${rWeight.toFixed(2)} sW=${sWeight.toFixed(
          2
        )} value=${value.toFixed(2)}`
      );
    }

    return value;
  }

  getLeadDebugGain(leadKey) {
    if (LIMB_LEADS.includes(leadKey)) {
      const angle = LIMB_LEAD_ANGLES[leadKey];
      if (typeof angle !== 'number') return 1;
      const diff = degWrap((this.axisDeg || 0) - angle);
      return safeNonZero(Math.cos(diff * DEG_TO_RAD_12), LIMB_MIN_SCALE);
    }
    if (PRECORDIAL_ORDER.includes(leadKey)) {
      const cfg = PRECORDIAL_BASE_GAINS[leadKey] || DEFAULT_PRECORDIAL_CONFIG;
      return cfg.baseGain || 1;
    }
    return 1;
  }

  getLeadSkewMs(leadKey) {
    if (!leadKey) return 0;
    if (!this._leadSkewMap) this._leadSkewMap = {};
    if (this._leadSkewMap[leadKey] == null) {
      const hash = this.hashLeadKey(`${leadKey}_skew`);
      this._leadSkewMap[leadKey] = ((hash % 7) - 3) * 0.6;
    }
    return this._leadSkewMap[leadKey];
  }

  hashLeadKey(key) {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  getWaveAxisDeg(type) {
    const axis = this.axisDeg || 0;
    if (type === 'P') return degWrap(axis - 10);
    if (type === 'T') return degWrap(axis + 20);
    return degWrap(axis);
  }

  sampleWaveComponentsAtTime(tMs, leadKey = 'BASE') {
    const duration = this.rhythmDurationMs || 8000;
    const time = ((tMs % duration) + duration) % duration;
    let p = 0;
    let qrs = 0;
    let tWave = 0;
    const qrsParts = { q: 0, r: 0, s: 0 };
    const skew = this.getLeadSkewMs(leadKey);

    for (const beat of this.beatSchedule) {
      if (!beat.hasP && !beat.hasQRS) continue;

      if (beat.hasP) {
        const pCenter = beat.rTime - beat.pr + 40;
        if (Math.abs(time - pCenter) <= 160) {
          p += this.drawP(time, pCenter, 80);
        }
      }

      if (beat.hasQRS && Math.abs(time - beat.rTime) <= beat.qrs * 2) {
        const parts = this.drawQRSParts(time, beat.rTime, beat.qrs, skew);
        qrsParts.q += parts.q;
        qrsParts.r += parts.r;
        qrsParts.s += parts.s;
        qrs += parts.q + parts.r + parts.s;
      }

      const qrsStart = beat.rTime - beat.qrs / 2;
      const tEnd = qrsStart + beat.qt;
      const tStart = Math.max(beat.rTime + beat.qrs / 2 + 60, tEnd - this.intervals.tWaveDurationMs);
      const tCenter = (tStart + tEnd) / 2;
      if (Math.abs(time - tCenter) <= 160) {
        tWave += this.drawT(time, tCenter, 120);
      }
    }

    return { total: p + qrs + tWave, P: p, QRS: qrs, T: tWave, qrsParts };
  }

  getBaseVoltageAtTimeMs(tMs) {
    return this.sampleWaveComponentsAtTime(tMs, 'BASE').total;
  }

  drawP(t, center, width) {
    const sigma = width / 6;
    const delta = t - center;
    return AMP_PX.P * Math.exp(-0.5 * Math.pow(delta / (sigma || 1), 2));
  }

  drawQRSParts(t, center, width, skewMs = 0) {
    const sigma = width / 10;
    const qCenter = center - width * 0.25 + skewMs;
    const sCenter = center + width * 0.25 - skewMs * 0.6;
    const q = AMP_PX.Q * Math.exp(-0.5 * Math.pow((t - qCenter) / sigma, 2));
    const r = AMP_PX.R * Math.exp(-0.5 * Math.pow((t - center) / sigma, 2));
    const s = AMP_PX.S * Math.exp(-0.5 * Math.pow((t - sCenter) / sigma, 2));
    return { q, r, s };
  }

  drawQRS(t, center, width, skewMs = 0) {
    const parts = this.drawQRSParts(t, center, width, skewMs);
    return parts.q + parts.r + parts.s;
  }

  drawT(t, center, width) {
    const sigma = width / 5;
    const delta = t - center;
    return AMP_PX.T * Math.exp(-0.5 * Math.pow(delta / (sigma || 1), 2));
  }

  waveTypeAtTime(tMs) {
    const duration = this.rhythmDurationMs || 8000;
    const time = ((tMs % duration) + duration) % duration;
    let closest = { type: 'BASE', dist: Infinity };
    const consider = (type, center, window) => {
      const dist = Math.abs(time - center);
      if (dist < window && dist < closest.dist) closest = { type, dist };
    };
    for (const beat of this.beatSchedule) {
      if (beat.hasP) consider('P', beat.rTime - beat.pr + 40, 90);
      consider('QRS', beat.rTime, beat.qrs);
      const qrsStart = beat.rTime - beat.qrs / 2;
      const tEnd = qrsStart + beat.qt;
      const tStart = Math.max(beat.rTime + beat.qrs / 2 + 60, tEnd - this.intervals.tWaveDurationMs);
      const tCenter = (tStart + tEnd) / 2;
      consider('T', tCenter, Math.max(80, tEnd - tStart));
    }
    return closest.type;
  }
}

window.Ecg12Simulator = Ecg12Simulator;
