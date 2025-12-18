(function () {
  'use strict';

  const STORAGE_KEY = 'cardiolearner.ekgTutorial.v1';

  function createSafeStorage() {
    try {
      const testKey = '__ekg_tutorial_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return {
        get() {
          const raw = window.localStorage.getItem(STORAGE_KEY);
          return raw ? JSON.parse(raw) : null;
        },
        set(value) {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
        },
        clear() {
          window.localStorage.removeItem(STORAGE_KEY);
        },
      };
    } catch (_) {
      let memory = null;
      return {
        get() {
          return memory;
        },
        set(value) {
          memory = value;
        },
        clear() {
          memory = null;
        },
      };
    }
  }

  const safeStorage = createSafeStorage();

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'html') node.innerHTML = value;
      else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
      else if (value === false || value == null) continue;
      else node.setAttribute(key, String(value));
    }
    for (const child of Array.isArray(children) ? children : [children]) {
      if (child == null) continue;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function formatPct(value) {
    return `${Math.round(value * 100)}%`;
  }

  function scoreQuiz(questions, answersById) {
    let correct = 0;
    for (const question of questions) {
      const given = answersById?.[question.id];
      if (given === question.correctIndex) correct += 1;
    }
    const total = questions.length || 1;
    return { correct, total, pct: correct / total };
  }

  function buildWaveformSvg({ highlightRegionId, showLabels }) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 800 200');
    svg.setAttribute('class', 'ekg-waveform');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Normal single-beat ECG waveform');

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <pattern id="ekgGridSmall" width="10" height="10" patternUnits="userSpaceOnUse">
        <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(148,163,184,0.20)" stroke-width="1"/>
      </pattern>
      <pattern id="ekgGridLarge" width="50" height="50" patternUnits="userSpaceOnUse">
        <rect width="50" height="50" fill="url(#ekgGridSmall)"/>
        <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(148,163,184,0.30)" stroke-width="1.2"/>
      </pattern>
      <filter id="ekgGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(37,99,235,0.35)"/>
      </filter>
    `;
    svg.appendChild(defs);

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', '0');
    bg.setAttribute('y', '0');
    bg.setAttribute('width', '800');
    bg.setAttribute('height', '200');
    bg.setAttribute('rx', '16');
    bg.setAttribute('fill', 'url(#ekgGridLarge)');
    svg.appendChild(bg);

    const baselineY = 120;
    const trace = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    trace.setAttribute(
      'd',
      [
        `M 40 ${baselineY}`,
        `L 90 ${baselineY}`,
        `Q 120 105 150 ${baselineY}`,
        `L 220 ${baselineY}`,
        `L 250 ${baselineY}`,
        `L 260 80`,
        `L 270 165`,
        `L 285 108`,
        `L 305 ${baselineY}`,
        `L 360 ${baselineY}`,
        `Q 420 95 480 ${baselineY}`,
        `Q 520 150 570 ${baselineY}`,
        `L 740 ${baselineY}`,
      ].join(' ')
    );
    trace.setAttribute('fill', 'none');
    trace.setAttribute('stroke', 'rgba(15,23,42,0.92)');
    trace.setAttribute('stroke-width', '4');
    trace.setAttribute('stroke-linecap', 'round');
    trace.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(trace);

    const regions = [
      { id: 'baseline', label: 'Baseline', x: 40, w: 70 },
      { id: 'p', label: 'P wave', x: 90, w: 80 },
      { id: 'pr', label: 'PR interval', x: 170, w: 90 },
      { id: 'qrs', label: 'QRS complex', x: 250, w: 75 },
      { id: 'st', label: 'ST segment', x: 325, w: 90 },
      { id: 't', label: 'T wave', x: 415, w: 170 },
    ];

    const overlayGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    overlayGroup.setAttribute('class', 'ekg-waveform-regions');
    svg.appendChild(overlayGroup);

    for (const region of regions) {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(region.x));
      rect.setAttribute('y', '30');
      rect.setAttribute('width', String(region.w));
      rect.setAttribute('height', '140');
      rect.setAttribute('rx', '10');
      rect.setAttribute('class', 'ekg-waveform-hit');
      rect.setAttribute('data-region', region.id);
      rect.setAttribute('tabindex', '0');
      rect.setAttribute('role', 'button');
      rect.setAttribute('aria-label', region.label);
      if (highlightRegionId === region.id) rect.classList.add('is-highlight');
      g.appendChild(rect);

      if (showLabels) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(region.x + region.w / 2));
        text.setAttribute('y', '24');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('class', 'ekg-waveform-label');
        text.textContent = region.label;
        g.appendChild(text);
      }

      overlayGroup.appendChild(g);
    }

    return svg;
  }

  function buildRhythmStripSvg({ irregular }) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 800 200');
    svg.setAttribute('class', 'ekg-waveform ekg-rhythm-strip');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', irregular ? 'Irregular rhythm strip example' : 'Regular rhythm strip example');

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <pattern id="ekgGridSmallStrip" width="10" height="10" patternUnits="userSpaceOnUse">
        <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(148,163,184,0.20)" stroke-width="1"/>
      </pattern>
      <pattern id="ekgGridLargeStrip" width="50" height="50" patternUnits="userSpaceOnUse">
        <rect width="50" height="50" fill="url(#ekgGridSmallStrip)"/>
        <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(148,163,184,0.30)" stroke-width="1.2"/>
      </pattern>
    `;
    svg.appendChild(defs);

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', '0');
    bg.setAttribute('y', '0');
    bg.setAttribute('width', '800');
    bg.setAttribute('height', '200');
    bg.setAttribute('rx', '16');
    bg.setAttribute('fill', 'url(#ekgGridLargeStrip)');
    svg.appendChild(bg);

    const baselineY = 120;
    const beatD = (x0) =>
      [
        `M ${x0 + 0} ${baselineY}`,
        `L ${x0 + 45} ${baselineY}`,
        `Q ${x0 + 70} 105 ${x0 + 95} ${baselineY}`,
        `L ${x0 + 140} ${baselineY}`,
        `L ${x0 + 155} ${baselineY}`,
        `L ${x0 + 162} 82`,
        `L ${x0 + 171} 168`,
        `L ${x0 + 185} 110`,
        `L ${x0 + 205} ${baselineY}`,
        `L ${x0 + 230} ${baselineY}`,
      ].join(' ');

    const starts = irregular ? [40, 270, 545] : [40, 310, 580];

    const d = [`M 20 ${baselineY}`, `L 760 ${baselineY}`].join(' ');
    const baseline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    baseline.setAttribute('d', d);
    baseline.setAttribute('fill', 'none');
    baseline.setAttribute('stroke', 'rgba(15,23,42,0.15)');
    baseline.setAttribute('stroke-width', '3');
    svg.appendChild(baseline);

    const trace = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    trace.setAttribute('d', starts.map((x0) => beatD(x0)).join(' '));
    trace.setAttribute('fill', 'none');
    trace.setAttribute('stroke', 'rgba(15,23,42,0.92)');
    trace.setAttribute('stroke-width', '4');
    trace.setAttribute('stroke-linecap', 'round');
    trace.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(trace);

    return svg;
  }

  function initEkgTutorial({ mountEl }) {
    if (!mountEl) return null;
    mountEl.innerHTML = '';

    const saved = safeStorage.get() || {};
    const state = {
      stepIndex: Number.isFinite(saved.stepIndex) ? clamp(saved.stepIndex, 0, 7) : 0,
      results: saved.results && typeof saved.results === 'object' ? saved.results : {},
      guidedRegionIndex: 0,
      tutorialWaveform: createTutorialWaveformEngine(),
    };

    const stepIds = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const stepTitles = [
      'Meet a Normal P–QRS–T',
      'Try it: identify the waves',
      'Quick check',
      'Single-lead workflow',
      'Rate & Rhythm',
      'Waves & Intervals',
      'Axis (Lead I / aVF)',
      'Final mixed quiz',
    ];

    const tooltip = el('div', {
      class: 'ekg-tooltip',
      role: 'tooltip',
      id: 'ekgTutorialTooltip',
      'aria-hidden': 'true',
    });

    const header = el('div', { class: 'ekg-tutorial-header' }, [
      el('div', {}, [
        el('div', { class: 'ekg-tutorial-kicker', text: 'EKG Tutorial' }),
        el('h3', { class: 'ekg-tutorial-title', text: 'Learn → practice → test' }),
        el('p', {
          class: 'ekg-tutorial-subtitle',
          text:
            'Start with one beat, then learn a reliable single-lead reading workflow: rate & rhythm → intervals → morphology → axis.',
        }),
      ]),
    ]);

    const progressText = el('div', { class: 'ekg-stepper-progress', text: '' });
    const backBtn = el('button', { type: 'button', class: 'ekg-stepper-btn', text: 'Back' });
    const nextBtn = el('button', { type: 'button', class: 'ekg-stepper-btn ekg-stepper-btn--primary', text: 'Next' });
    const restartBtn = el('button', { type: 'button', class: 'ekg-stepper-btn ekg-stepper-btn--ghost', text: 'Restart' });

    const stepper = el('div', { class: 'ekg-stepper' }, [
      progressText,
      el('div', { class: 'ekg-stepper-actions' }, [backBtn, nextBtn, restartBtn]),
    ]);

    const content = el('div', { class: 'ekg-step-content' });
    const root = el('section', { class: 'ekg-tutorial', id: 'ekg-tutorial' }, [header, stepper, content, tooltip]);
    mountEl.appendChild(root);

    const regionInfo = {
      baseline: {
        title: 'Baseline',
        body:
          'The isoelectric line: no net electrical vector. Use it as your reference for ST elevation/depression.',
        normal: 'ST should sit near baseline.',
        why: 'ST changes can signal ischemia or injury.',
      },
      p: {
        title: 'P wave',
        body: 'Atrial depolarization (sinus node → atria).',
        normal: 'Usually upright in lead II and precedes every QRS in sinus rhythm.',
        why: 'Absent or abnormal P waves suggest atrial rhythm problems.',
      },
      pr: {
        title: 'PR interval',
        body: 'Time from atrial depolarization to ventricular depolarization (through AV node/His-Purkinje).',
        normal: '0.12–0.20 s (3–5 small boxes at 25 mm/s).',
        why: 'Prolonged PR suggests 1° AV block; short PR can suggest pre-excitation.',
      },
      qrs: {
        title: 'QRS complex',
        body: 'Ventricular depolarization.',
        normal: '< 0.12 s (under 3 small boxes).',
        why: 'Wide QRS suggests bundle branch block, ventricular rhythm, or drug/toxic effects.',
      },
      st: {
        title: 'ST segment',
        body: 'Early ventricular repolarization (plateau phase).',
        normal: 'Should be near baseline.',
        why: 'Elevation/depression can indicate ischemia, infarction, or pericarditis.',
      },
      t: {
        title: 'T wave',
        body: 'Ventricular repolarization.',
        normal: 'Usually upright in lead II; shape varies with rate and electrolytes.',
        why: 'Peaked, inverted, or hyperacute T waves can signal dangerous pathology.',
      },
    };

    function persist() {
      safeStorage.set({
        stepIndex: state.stepIndex,
        results: state.results,
      });
    }

    function showTooltipForRegion(targetEl, regionId, pointerEvent) {
      const info = regionInfo[regionId];
      if (!info) return;

      tooltip.innerHTML = '';
      tooltip.appendChild(
        el('div', { class: 'ekg-tooltip-title', text: info.title }),
      );
      tooltip.appendChild(el('div', { class: 'ekg-tooltip-body', text: info.body }));
      tooltip.appendChild(el('div', { class: 'ekg-tooltip-meta' }, [
        el('div', { class: 'ekg-tooltip-chip' }, [el('strong', { text: 'Normal: ' }), info.normal]),
        el('div', { class: 'ekg-tooltip-chip' }, [el('strong', { text: 'Why it matters: ' }), info.why]),
      ]));

      tooltip.setAttribute('aria-hidden', 'false');
      tooltip.classList.add('is-visible');

      const rootRect = root.getBoundingClientRect();
      let x = rootRect.left + 12;
      let y = rootRect.top + 12;

      if (pointerEvent && typeof pointerEvent.clientX === 'number') {
        x = pointerEvent.clientX + 14;
        y = pointerEvent.clientY + 14;
      } else if (targetEl && typeof targetEl.getBoundingClientRect === 'function') {
        const rect = targetEl.getBoundingClientRect();
        x = rect.left + rect.width * 0.5;
        y = rect.top - 10;
      }

      const maxLeft = rootRect.left + rootRect.width - 320;
      const maxTop = rootRect.top + rootRect.height - 160;
      const left = clamp(x - rootRect.left, 12, Math.max(12, maxLeft - rootRect.left));
      const top = clamp(y - rootRect.top, 12, Math.max(12, maxTop - rootRect.top));

      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    }

    function hideTooltip() {
      tooltip.setAttribute('aria-hidden', 'true');
      tooltip.classList.remove('is-visible');
    }

    const TUTORIAL_REGION_ORDER = ['baseline', 'p', 'pr', 'qrs', 'st', 't'];

    function computeTutorialRegions(sim) {
      if (!sim || !Array.isArray(sim.beatSchedule) || !sim.beatSchedule.length) return [];
      const beat = sim.beatSchedule.find((item) => item && item.hasQRS !== false) || sim.beatSchedule[0];
      if (!beat) return [];
      const qrsDuration = beat.qrs || sim.intervals.qrsDurationMs || 90;
      const prInterval = beat.pr || sim.intervals.prIntervalMs || 160;
      const pDuration = sim.intervals.pWaveDurationMs || 90;
      const qrsStart = beat.rTime - qrsDuration / 2;
      const prStart = qrsStart - prInterval;
      const pEnd = prStart + pDuration;
      const qrsEnd = qrsStart + qrsDuration;
      const qtEnd = qrsStart + (beat.qt || sim.intervals.qtIntervalMs || 400);
      const stStart = qrsEnd;
      const tStart = Math.max(qrsEnd + 60, qtEnd - (sim.intervals.tWaveDurationMs || 180));
      const baselineStart = Math.max(0, prStart - Math.max(80, prInterval * 0.5));

      const regions = [
        { id: 'baseline', start: baselineStart, end: prStart },
        { id: 'p', start: prStart, end: Math.min(pEnd, qrsStart) },
        { id: 'pr', start: prStart, end: qrsStart },
        { id: 'qrs', start: qrsStart, end: qrsEnd },
        { id: 'st', start: stStart, end: Math.max(stStart, tStart) },
        { id: 't', start: tStart, end: Math.max(tStart, qtEnd) },
      ];

      return regions.map((region) => {
        const start = Math.max(0, Math.min(region.start, region.end));
        const end = Math.max(start + 1, region.end);
        return { ...region, start, end };
      });
    }

    function createTutorialWaveformEngine() {
      const host = el('div', { class: 'tutorial-waveform-wrap', role: 'presentation' });
      const backgroundCanvas = document.createElement('canvas');
      backgroundCanvas.className = 'tutorial-canvas tutorial-canvas--background';
      const traceCanvas = document.createElement('canvas');
      traceCanvas.className = 'tutorial-canvas tutorial-canvas--trace';
      const overlayCanvas = document.createElement('canvas');
      overlayCanvas.className = 'tutorial-canvas tutorial-canvas--overlay';
      const hitLayer = el('div', { class: 'tutorial-hit-layer', role: 'presentation' });
      const highlightIndicator = el('div', { class: 'tutorial-highlight-indicator', 'aria-hidden': 'true' });
      hitLayer.appendChild(highlightIndicator);
      host.appendChild(backgroundCanvas);
      host.appendChild(traceCanvas);
      host.appendChild(overlayCanvas);
      host.appendChild(hitLayer);

      const chipRow = el('div', { class: 'tutorial-chip-row', role: 'toolbar', 'aria-label': 'EKG wave regions' });
      const chipButtons = {};
      TUTORIAL_REGION_ORDER.forEach((id) => {
        const info = regionInfo[id];
        const btn = el('button', {
          type: 'button',
          class: 'tutorial-chip',
          text: info?.title || id,
          'aria-pressed': 'false',
        });
        chipRow.appendChild(btn);
        chipButtons[id] = btn;
      });

      let simInstance = null;
      let lastRegions = [];
      let pendingRun = null;
      let requestedRegionId = null;

      const regionAtTime = (timeMs) => {
        if (!lastRegions.length) return null;
        return lastRegions.find((region) => timeMs >= region.start && timeMs <= region.end);
      };

      const updateHighlight = () => {
        const inst = simInstance;
        if (!inst) return;
        const region = requestedRegionId ? lastRegions.find((item) => item.id === requestedRegionId) : null;
        const width = inst.renderWidth || inst.traceCanvas?.clientWidth || host.clientWidth;
        const duration = Math.max(1, inst.computeSweepDurationMs());
        if (!region || !width) {
          highlightIndicator.style.opacity = '0';
        } else {
          const base = inst.sweepStartTime || 0;
          const startX = ((region.start - base) / duration) * width;
          const endX = ((region.end - base) / duration) * width;
          highlightIndicator.style.left = `${Math.max(0, startX)}px`;
          highlightIndicator.style.width = `${Math.max(4, Math.min(width, endX) - Math.max(0, startX))}px`;
          highlightIndicator.style.opacity = '1';
        }
        Object.entries(chipButtons).forEach(([id, button]) => {
          if (!button) return;
          const active = id === requestedRegionId;
          button.classList.toggle('tutorial-chip--active', active);
          button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
      };

      const showRegionTooltip = (regionId, options = {}) => {
        if (!regionId) return;
        const eventTarget = options.event?.target || highlightIndicator;
        const tooltipEvent = options.event;
        showTooltipForRegion(eventTarget, regionId, tooltipEvent);
      };

      const setActiveRegion = (id, options = {}) => {
        requestedRegionId = id;
        if (id && options.showTooltip) {
          showRegionTooltip(id, options);
        } else if (!id) {
          hideTooltip();
        }
        updateHighlight();
      };

      const ensureSim = () => {
        if (simInstance) return simInstance;
        if (typeof window.Ecg12Simulator !== 'function') return null;
        simInstance = new window.Ecg12Simulator(
          { backgroundCanvas, traceCanvas, overlayCanvas },
          { displayTime: 10, heartRate: 75, rhythm: 'sinus' }
        );
        simInstance.setLoopingEnabled(false);
        simInstance.setRhythm('sinus');
        simInstance.setHeartRate(75);
        return simInstance;
      };

      const attachHost = (parent) => {
        if (!parent || !host) return;
        if (host.parentElement && host.parentElement !== parent) {
          host.parentElement.removeChild(host);
        }
        if (!parent.contains(host)) {
          parent.appendChild(host);
        }
        requestAnimationFrame(() => {
          ensureSim()?.handleResize?.();
          updateHighlight();
        });
      };

      const attachChips = (parent) => {
        if (!parent || !chipRow) return;
        if (chipRow.parentElement && chipRow.parentElement !== parent) {
          chipRow.parentElement.removeChild(chipRow);
        }
        if (!parent.contains(chipRow)) {
          parent.appendChild(chipRow);
        }
      };

      const runOnce = async () => {
        const inst = ensureSim();
        if (!inst) return;
        if (pendingRun) pendingRun = null;
        inst.handleResize?.();
        pendingRun = inst.renderOnceAndFreeze?.();
        if (pendingRun && typeof pendingRun.then === 'function') {
          await pendingRun;
        }
        lastRegions = computeTutorialRegions(inst);
        updateHighlight();
      };

      hitLayer.addEventListener('pointermove', (event) => {
        const inst = ensureSim();
        if (!inst) return;
        const rect = hitLayer.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const width = inst.renderWidth || inst.traceCanvas?.clientWidth || host.clientWidth;
        if (!width) return;
        const duration = Math.max(1, inst.computeSweepDurationMs());
        const clampedX = Math.max(0, Math.min(width, x));
        const time = (inst.sweepStartTime || 0) + (clampedX / width) * duration;
        const region = regionAtTime(time);
        if (region) {
          setActiveRegion(region.id, { event, showTooltip: true });
        } else {
          setActiveRegion(null);
        }
      });

      hitLayer.addEventListener('pointerleave', () => {
        setActiveRegion(null);
        hideTooltip();
      });

      TUTORIAL_REGION_ORDER.forEach((id) => {
        const button = chipButtons[id];
        if (!button) return;
        button.addEventListener('focus', () => setActiveRegion(id, { showTooltip: true }));
        button.addEventListener('blur', () => {
          setActiveRegion(null);
          hideTooltip();
        });
        button.addEventListener('click', () => setActiveRegion(id, { showTooltip: true }));
      });

      window.addEventListener('resize', updateHighlight);

      return {
        host,
        chipRow,
        attachHost,
        attachChips,
        playOnce: () => runOnce(),
        setActiveRegion,
        setPreferredRegion: (id) => {
          requestedRegionId = id;
          updateHighlight();
        },
      };
    }

    function renderStepA() {
      state.guidedRegionIndex = clamp(state.guidedRegionIndex, 0, 5);
      const ordered = ['baseline', 'p', 'pr', 'qrs', 'st', 't'];
      const activeId = ordered[state.guidedRegionIndex];

      const helper = el('div', { class: 'ekg-card' }, [
        el('div', { class: 'ekg-card-title', text: 'Guided highlight' }),
        el('p', {
          class: 'ekg-card-text',
          text: 'Use Next/Back below to step through each part, or hover/focus regions on the waveform.',
        }),
      ]);

      const waveSlot = el('div', { class: 'tutorial-wave-slot' });
      state.tutorialWaveform.attachHost(waveSlot);
      state.tutorialWaveform.setPreferredRegion(activeId);
      state.tutorialWaveform.setActiveRegion(activeId);
      state.tutorialWaveform.playOnce();
      const replayButton = el('button', {
        type: 'button',
        class: 'ekg-mini-btn ekg-mini-btn--primary',
        text: 'Replay animation',
        onclick: () => state.tutorialWaveform.playOnce(),
      });
      const replayRow = el('div', { class: 'tutorial-waveform-actions' }, [replayButton]);

      const info = regionInfo[activeId];
      const focusCard = el('div', { class: 'ekg-card ekg-card--focus', 'aria-live': 'polite' }, [
        el('div', { class: 'ekg-card-title', text: info.title }),
        el('p', { class: 'ekg-card-text', text: info.body }),
        el('ul', { class: 'ekg-bullets' }, [
          el('li', { text: info.normal }),
          el('li', { text: info.why }),
        ]),
        el('div', { class: 'ekg-inline-actions' }, [
          el('button', {
            type: 'button',
            class: 'ekg-mini-btn',
            text: 'Previous part',
            onclick: () => {
              state.guidedRegionIndex = clamp(state.guidedRegionIndex - 1, 0, ordered.length - 1);
              render();
            },
          }),
          el('button', {
            type: 'button',
            class: 'ekg-mini-btn ekg-mini-btn--primary',
            text: 'Next part',
            onclick: () => {
              state.guidedRegionIndex = clamp(state.guidedRegionIndex + 1, 0, ordered.length - 1);
              render();
            },
          }),
        ]),
      ]);

      return el('div', { class: 'ekg-step-body' }, [helper, waveSlot, replayRow, focusCard]);
    }

    function renderStepB() {
      const waveSlot = el('div', { class: 'tutorial-wave-slot' });
      state.tutorialWaveform.attachHost(waveSlot);
      state.tutorialWaveform.playOnce();
      state.tutorialWaveform.setActiveRegion(null);
      const chipHost = el('div', { class: 'tutorial-chip-host' });
      state.tutorialWaveform.attachChips(chipHost);
      const replayButton = el('button', {
        type: 'button',
        class: 'ekg-mini-btn ekg-mini-btn--primary',
        text: 'Replay animation',
        onclick: () => state.tutorialWaveform.playOnce(),
      });
      const replayRow = el('div', { class: 'tutorial-waveform-actions' }, [replayButton]);

      const checklist = el('div', { class: 'ekg-card' }, [
        el('div', { class: 'ekg-card-title', text: 'Your task' }),
        el('p', {
          class: 'ekg-card-text',
          text:
            'Hover (or tab) over each region and read the popover. Then use the checklist to self-confirm you found each item.',
        }),
        el('div', { class: 'ekg-checklist' }, [
          ...[
            ['p', 'P wave'],
            ['pr', 'PR interval'],
            ['qrs', 'QRS complex'],
            ['st', 'ST segment'],
            ['t', 'T wave'],
          ].map(([id, label]) => {
            const inputId = `ekg-tut-seen-${id}`;
            const checked = Boolean(state.results?.seen?.[id]);
            const input = el('input', {
              type: 'checkbox',
              id: inputId,
              checked: checked ? 'checked' : null,
              onchange: (e) => {
                state.results.seen = state.results.seen || {};
                state.results.seen[id] = Boolean(e.target.checked);
                persist();
              },
            });
            return el('label', { class: 'ekg-check' }, [input, el('span', { text: label })]);
          }),
        ]),
      ]);

      return el('div', { class: 'ekg-step-body' }, [
        el('div', { class: 'ekg-card' }, [
          el('div', { class: 'ekg-card-title', text: 'Try it: identify the waves' }),
          el('p', {
            class: 'ekg-card-text',
            text:
              'Reading ECGs starts with pattern recognition. Learn where to look: P → PR → QRS → ST → T.',
          }),
        ]),
        waveSlot,
        chipHost,
        el('p', {
          class: 'ekg-card-text tutorial-chip-note',
          text: 'Use the chips above to highlight each region; keyboard focus works too.',
        }),
        replayRow,
        checklist,
      ]);
    }

    const stepCQuestions = [
      {
        id: 'c1',
        prompt: 'Which deflection represents ventricular depolarization?',
        options: ['P wave', 'QRS complex', 'T wave', 'ST segment'],
        correctIndex: 1,
        explanation: 'The QRS complex is ventricular depolarization.',
      },
      {
        id: 'c2',
        prompt: 'A normal QRS duration is typically:',
        options: ['< 0.12 s', '0.20–0.30 s', '> 0.20 s', 'Always 0.16 s'],
        correctIndex: 0,
        explanation: 'Normal QRS is narrow: < 0.12 seconds.',
      },
      {
        id: 'c3',
        prompt: 'The PR interval primarily reflects conduction through the:',
        options: ['SA node only', 'AV node / His-Purkinje system', 'Ventricular myocardium', 'Purkinje only'],
        correctIndex: 1,
        explanation: 'PR spans atrial depolarization to ventricular depolarization, heavily influenced by AV nodal delay.',
      },
      {
        id: 'c4',
        prompt: 'The T wave represents:',
        options: ['Atrial repolarization', 'Ventricular repolarization', 'Ventricular depolarization', 'AV nodal conduction'],
        correctIndex: 1,
        explanation: 'T wave is ventricular repolarization.',
      },
      {
        id: 'c5',
        prompt: 'ST segment changes are most associated with:',
        options: ['Ischemia/injury patterns', 'Only atrial rhythms', 'Valve disease only', 'Normal aging only'],
        correctIndex: 0,
        explanation: 'ST elevation/depression can indicate ischemia/injury (among other causes).',
      },
    ];

    function renderQuiz({ questions, storageKey, minPctToPass }) {
      const saved = state.results?.[storageKey] || {};
      const answers = saved.answers && typeof saved.answers === 'object' ? saved.answers : {};
      const feedback = el('div', { class: 'ekg-quiz-feedback', 'aria-live': 'polite' });

      function persistAnswers() {
        state.results[storageKey] = state.results[storageKey] || {};
        state.results[storageKey].answers = answers;
        persist();
      }

      function renderFeedback() {
        const s = scoreQuiz(questions, answers);
        const passed = s.pct >= minPctToPass;
        state.results[storageKey] = state.results[storageKey] || {};
        state.results[storageKey].score = s;
        state.results[storageKey].passed = passed;
        persist();

        feedback.classList.toggle('success', passed);
        feedback.classList.toggle('error', !passed);
        feedback.textContent = passed
          ? `Passed: ${s.correct}/${s.total} (${formatPct(s.pct)}).`
          : `Not yet: ${s.correct}/${s.total} (${formatPct(s.pct)}). Aim for ${Math.round(minPctToPass * 100)}%+.`;
      }

      const form = el('form', {
        class: 'ekg-quiz',
        onsubmit: (e) => {
          e.preventDefault();
          renderFeedback();
        },
      });

      for (const q of questions) {
        const fieldset = el('fieldset', { class: 'ekg-q' }, [
          el('legend', { class: 'ekg-q-prompt', text: q.prompt }),
        ]);

        q.options.forEach((opt, idx) => {
          const id = `${storageKey}-${q.id}-${idx}`;
          const input = el('input', {
            type: 'radio',
            name: `${storageKey}-${q.id}`,
            id,
            value: String(idx),
            checked: answers[q.id] === idx ? 'checked' : null,
            onchange: (e) => {
              answers[q.id] = Number(e.target.value);
              persistAnswers();
            },
          });
          const option = el('label', { class: 'ekg-q-option', for: id }, [input, el('span', { text: opt })]);
          fieldset.appendChild(option);
        });

        fieldset.appendChild(el('div', { class: 'ekg-q-expl', 'data-expl-for': q.id }));
        form.appendChild(fieldset);
      }

      const submit = el('button', { type: 'submit', class: 'ekg-stepper-btn ekg-stepper-btn--primary', text: 'Submit' });
      const reset = el('button', {
        type: 'button',
        class: 'ekg-stepper-btn ekg-stepper-btn--ghost',
        text: 'Clear answers',
        onclick: () => {
          for (const q of questions) delete answers[q.id];
          persistAnswers();
          render();
        },
      });

      form.appendChild(el('div', { class: 'ekg-quiz-actions' }, [submit, reset]));
      form.appendChild(feedback);

      if (saved?.score) {
        renderFeedback();
      } else {
        feedback.textContent = `Submit when ready (pass ≥ ${Math.round(minPctToPass * 100)}%).`;
      }

      form.addEventListener('submit', () => {
        for (const q of questions) {
          const expl = form.querySelector(`[data-expl-for="${q.id}"]`);
          if (!expl) continue;
          const given = answers[q.id];
          if (given == null) {
            expl.textContent = 'Pick an answer to see feedback.';
            expl.className = 'ekg-q-expl';
            continue;
          }
          const correct = given === q.correctIndex;
          expl.textContent = correct ? `Correct. ${q.explanation}` : `Incorrect. ${q.explanation}`;
          expl.className = `ekg-q-expl ${correct ? 'correct' : 'incorrect'}`;
        }
      });

      return form;
    }

    function renderStepC() {
      return el('div', { class: 'ekg-step-body' }, [
        el('div', { class: 'ekg-card' }, [
          el('div', { class: 'ekg-card-title', text: 'Quick check (P–QRS–T)' }),
          el('p', {
            class: 'ekg-card-text',
            text:
              'Reinforce what you just learned. Passing stores your result and helps you track progress across refreshes.',
          }),
        ]),
        renderQuiz({ questions: stepCQuestions, storageKey: 'stepC', minPctToPass: 0.8 }),
      ]);
    }

    function renderStepD() {
      const items = [
        'Rate (fast/slow/normal)',
        'Rhythm (regular/irregular, sinus?)',
        'Intervals (PR, QRS, QT)',
        'Morphology (P/QRS/T/ST patterns)',
        'Axis (Lead I / aVF quadrant method)',
      ];
      return el('div', { class: 'ekg-step-body' }, [
        el('div', { class: 'ekg-card' }, [
          el('div', { class: 'ekg-card-title', text: 'A reliable single-lead workflow' }),
          el('p', {
            class: 'ekg-card-text',
            text:
              'When you feel “lost” on an ECG, return to a fixed order. It prevents missed findings and keeps your interpretation organized.',
          }),
          el('ol', { class: 'ekg-ordered' }, items.map((t) => el('li', { text: t }))),
        ]),
      ]);
    }

    function renderStepE() {
      const rateOut = el('div', { class: 'ekg-output', text: 'Enter a value to calculate.' });
      const largeBoxesInput = el('input', {
        type: 'number',
        min: '1',
        step: '1',
        inputmode: 'numeric',
        class: 'ekg-input',
        value: state.results?.rateTool?.largeBoxes ?? '',
      });
      const sixSecondInput = el('input', {
        type: 'number',
        min: '0',
        step: '1',
        inputmode: 'numeric',
        class: 'ekg-input',
        value: state.results?.rateTool?.rWaves6s ?? '',
      });

      function updateRate() {
        const largeBoxes = Number(largeBoxesInput.value);
        const rWaves6s = Number(sixSecondInput.value);
        const messages = [];

        if (Number.isFinite(largeBoxes) && largeBoxes > 0) {
          const bpm = Math.round(300 / largeBoxes);
          messages.push(`300 rule: ${bpm} bpm (${bpm < 60 ? 'brady' : bpm > 100 ? 'tachy' : 'normal'}).`);
        }

        if (Number.isFinite(rWaves6s) && rWaves6s >= 0) {
          const bpm = Math.round(rWaves6s * 10);
          messages.push(`6-second method: ${bpm} bpm (${bpm < 60 ? 'brady' : bpm > 100 ? 'tachy' : 'normal'}).`);
        }

        rateOut.textContent = messages.length ? messages.join(' ') : 'Enter a value to calculate.';
        state.results.rateTool = state.results.rateTool || {};
        state.results.rateTool.largeBoxes = largeBoxesInput.value;
        state.results.rateTool.rWaves6s = sixSecondInput.value;
        persist();
      }

      largeBoxesInput.addEventListener('input', updateRate);
      sixSecondInput.addEventListener('input', updateRate);
      updateRate();

      const rhythmQuizOut = el('div', { class: 'ekg-output', text: '' });
      const rhythmState = {
        sample: state.results?.rhythmTool?.sample || 'regular',
        answer: state.results?.rhythmTool?.answer ?? null,
      };

      function renderRhythmFeedback() {
        if (!rhythmState.answer) {
          rhythmQuizOut.textContent = 'Pick an answer.';
          rhythmQuizOut.classList.remove('success', 'error');
          return;
        }
        const correct = rhythmState.answer === rhythmState.sample;
        rhythmQuizOut.textContent = correct
          ? 'Correct: regular means consistent R–R spacing; irregularly irregular suggests atrial fibrillation.'
          : 'Not quite. Re-check whether the R–R spacing is consistent beat-to-beat.';
        rhythmQuizOut.classList.toggle('success', correct);
        rhythmQuizOut.classList.toggle('error', !correct);
      }

      function persistRhythm() {
        state.results.rhythmTool = { sample: rhythmState.sample, answer: rhythmState.answer };
        persist();
      }

      const sampleTabs = el('div', { class: 'ekg-pill-row' }, [
        el('button', {
          type: 'button',
          class: `ekg-pill ${rhythmState.sample === 'regular' ? 'active' : ''}`,
          text: 'Regular strip',
          onclick: () => {
            rhythmState.sample = 'regular';
            persistRhythm();
            render();
          },
        }),
        el('button', {
          type: 'button',
          class: `ekg-pill ${rhythmState.sample === 'irregular' ? 'active' : ''}`,
          text: 'Irregularly irregular strip',
          onclick: () => {
            rhythmState.sample = 'irregular';
            persistRhythm();
            render();
          },
        }),
      ]);

      const strip = el('div', { class: 'ekg-strip', 'aria-label': 'Example rhythm strip' }, [
        buildRhythmStripSvg({ irregular: rhythmState.sample === 'irregular' }),
      ]);

      const answerRow = el('div', { class: 'ekg-pill-row' }, [
        el('button', {
          type: 'button',
          class: `ekg-pill ${rhythmState.answer === 'regular' ? 'active' : ''}`,
          text: 'Regular',
          onclick: () => {
            rhythmState.answer = 'regular';
            persistRhythm();
            renderRhythmFeedback();
          },
        }),
        el('button', {
          type: 'button',
          class: `ekg-pill ${rhythmState.answer === 'irregular' ? 'active' : ''}`,
          text: 'Irregular',
          onclick: () => {
            rhythmState.answer = 'irregular';
            persistRhythm();
            renderRhythmFeedback();
          },
        }),
      ]);

      renderRhythmFeedback();

      return el('div', { class: 'ekg-step-body' }, [
        el('div', { class: 'ekg-card' }, [
          el('div', { class: 'ekg-card-title', text: 'Rate' }),
          el('p', { class: 'ekg-card-text', text: 'Normal adult resting rate is typically 60–100 bpm.' }),
          el('div', { class: 'ekg-two-col' }, [
            el('label', { class: 'ekg-field' }, [
              el('span', { class: 'ekg-field-label', text: 'Large boxes between R–R (300 rule)' }),
              largeBoxesInput,
            ]),
            el('label', { class: 'ekg-field' }, [
              el('span', { class: 'ekg-field-label', text: 'R waves in 6 seconds' }),
              sixSecondInput,
            ]),
          ]),
          rateOut,
        ]),
        el('div', { class: 'ekg-card' }, [
          el('div', { class: 'ekg-card-title', text: 'Rhythm' }),
          el('p', { class: 'ekg-card-text', text: 'Decide if the rhythm is regular or irregular by comparing R–R spacing.' }),
          sampleTabs,
          strip,
          el('div', { class: 'ekg-card-title', text: 'Your answer' }),
          answerRow,
          rhythmQuizOut,
        ]),
      ]);
    }

    function renderStepF() {
      const out = el('div', { class: 'ekg-output', text: '' });
      const sampleSelect = el('select', { class: 'ekg-input' }, [
        el('option', { value: 'pr-normal', text: 'PR interval: normal' }),
        el('option', { value: 'pr-long', text: 'PR interval: prolonged (1° AV block)' }),
        el('option', { value: 'qrs-normal', text: 'QRS duration: normal' }),
        el('option', { value: 'qrs-wide', text: 'QRS duration: wide' }),
      ]);

      const smallBoxesInput = el('input', {
        type: 'number',
        min: '0',
        step: '0.5',
        inputmode: 'decimal',
        class: 'ekg-input',
        value: state.results?.intervalTool?.smallBoxes ?? '',
      });

      const storedSample = state.results?.intervalTool?.sample;
      if (storedSample) sampleSelect.value = storedSample;

      function expectedRange(sampleKey) {
        if (sampleKey === 'pr-normal') return { label: 'PR normal', min: 0.12, max: 0.2 };
        if (sampleKey === 'pr-long') return { label: 'PR prolonged', min: 0.21, max: 0.4 };
        if (sampleKey === 'qrs-normal') return { label: 'QRS normal', min: 0.04, max: 0.11 };
        return { label: 'QRS wide', min: 0.12, max: 0.3 };
      }

      function update() {
        const sampleKey = sampleSelect.value;
        const smallBoxes = Number(smallBoxesInput.value);
        const seconds = Number.isFinite(smallBoxes) ? smallBoxes * 0.04 : NaN;
        const exp = expectedRange(sampleKey);

        state.results.intervalTool = state.results.intervalTool || {};
        state.results.intervalTool.sample = sampleKey;
        state.results.intervalTool.smallBoxes = smallBoxesInput.value;
        persist();

        if (!Number.isFinite(seconds) || seconds <= 0) {
          out.textContent = 'Enter a small-box count to convert to seconds (1 small box = 0.04 s at 25 mm/s).';
          out.classList.remove('success', 'error');
          return;
        }

        const ok = seconds >= exp.min && seconds <= exp.max;
        out.textContent = `${exp.label}: ${seconds.toFixed(2)} s. ${ok ? 'Within expected range.' : 'Outside expected range.'}`;
        out.classList.toggle('success', ok);
        out.classList.toggle('error', !ok);
      }

      sampleSelect.addEventListener('change', update);
      smallBoxesInput.addEventListener('input', update);
      update();

      return el('div', { class: 'ekg-step-body' }, [
        el('div', { class: 'ekg-card' }, [
          el('div', { class: 'ekg-card-title', text: 'Key normal intervals' }),
          el('ul', { class: 'ekg-bullets' }, [
            el('li', { text: 'PR: 0.12–0.20 s (3–5 small boxes)' }),
            el('li', { text: 'QRS: < 0.12 s (under 3 small boxes)' }),
            el('li', { text: 'ST: near baseline (interpret in clinical context)' }),
          ]),
        ]),
        el('div', { class: 'ekg-card' }, [
          el('div', { class: 'ekg-card-title', text: 'Measure practice (box-count → seconds)' }),
          el('div', { class: 'ekg-two-col' }, [
            el('label', { class: 'ekg-field' }, [
              el('span', { class: 'ekg-field-label', text: 'Sample to “match”' }),
              sampleSelect,
            ]),
            el('label', { class: 'ekg-field' }, [
              el('span', { class: 'ekg-field-label', text: 'Small boxes counted' }),
              smallBoxesInput,
            ]),
          ]),
          out,
        ]),
      ]);
    }

    const axisQuestions = [
      { id: 'ax1', leadI: '+', avf: '+', correct: 'normal', expl: 'Lead I + and aVF + suggests a normal axis.' },
      { id: 'ax2', leadI: '+', avf: '-', correct: 'left', expl: 'Lead I + and aVF − suggests left axis deviation.' },
      { id: 'ax3', leadI: '-', avf: '+', correct: 'right', expl: 'Lead I − and aVF + suggests right axis deviation.' },
      { id: 'ax4', leadI: '-', avf: '-', correct: 'extreme', expl: 'Lead I − and aVF − suggests extreme axis.' },
    ];

    function renderStepG() {
      const saved = state.results.axis || {};
      const feedback = el('div', { class: 'ekg-quiz-feedback', 'aria-live': 'polite' });
      const answers = saved.answers && typeof saved.answers === 'object' ? saved.answers : {};

      function persistAxis() {
        state.results.axis = state.results.axis || {};
        state.results.axis.answers = answers;
        persist();
      }

      function updateFeedback() {
        const total = axisQuestions.length;
        let correct = 0;
        for (const q of axisQuestions) {
          if (answers[q.id] === q.correct) correct += 1;
        }
        feedback.textContent = `Score: ${correct}/${total}.`;
        feedback.classList.toggle('success', correct === total);
        feedback.classList.toggle('error', correct !== total);
        state.results.axis.score = { correct, total, pct: total ? correct / total : 0 };
        persist();
      }

      const card = el('div', { class: 'ekg-card' }, [
        el('div', { class: 'ekg-card-title', text: 'Axis: Lead I / aVF quadrant method' }),
        el('p', {
          class: 'ekg-card-text',
          text:
            'Simplify axis into 4 buckets by asking: is the QRS predominantly positive or negative in Lead I and aVF?',
        }),
        el('div', { class: 'ekg-axis-grid' }, axisQuestions.map((q, idx) => {
          const prompt = `Case ${idx + 1}: Lead I ${q.leadI}, aVF ${q.avf}`;
          const row = el('div', { class: 'ekg-axis-card' }, [
            el('div', { class: 'ekg-axis-prompt', text: prompt }),
          ]);
          const options = [
            ['normal', 'Normal axis'],
            ['left', 'Left axis'],
            ['right', 'Right axis'],
            ['extreme', 'Extreme axis'],
          ];
          for (const [value, label] of options) {
            const id = `axis-${q.id}-${value}`;
            const input = el('input', {
              type: 'radio',
              name: `axis-${q.id}`,
              id,
              checked: answers[q.id] === value ? 'checked' : null,
              onchange: () => {
                answers[q.id] = value;
                persistAxis();
                updateFeedback();
                render();
              },
            });
            row.appendChild(el('label', { class: 'ekg-axis-option', for: id }, [input, el('span', { text: label })]));
          }
          const expl = answers[q.id]
            ? el('div', {
                class: `ekg-q-expl ${answers[q.id] === q.correct ? 'correct' : 'incorrect'}`,
                text: q.expl,
              })
            : null;
          if (expl) row.appendChild(expl);
          return row;
        })),
        feedback,
      ]);

      updateFeedback();
      return el('div', { class: 'ekg-step-body' }, [card]);
    }

    const finalQuestions = [
      ...stepCQuestions.map((q) => ({ ...q, id: `f_${q.id}` })),
      {
        id: 'f1',
        prompt: 'A rate of 140 bpm is best described as:',
        options: ['Normal', 'Bradycardia', 'Tachycardia', 'Asystole'],
        correctIndex: 2,
        explanation: 'Tachycardia is > 100 bpm.',
      },
      {
        id: 'f2',
        prompt: 'Lead I negative and aVF positive suggests:',
        options: ['Normal axis', 'Left axis deviation', 'Right axis deviation', 'Extreme axis'],
        correctIndex: 2,
        explanation: 'Lead I − and aVF + suggests right axis deviation.',
      },
      {
        id: 'f3',
        prompt: 'A PR interval of 0.24 s is:',
        options: ['Normal', 'Prolonged', 'Short', 'Not measurable'],
        correctIndex: 1,
        explanation: 'PR > 0.20 s is prolonged (1° AV block).',
      },
      {
        id: 'f4',
        prompt: 'First step in a systematic single-lead read is:',
        options: ['Axis', 'Intervals', 'Rate & rhythm', 'ST segment only'],
        correctIndex: 2,
        explanation: 'Start with rate & rhythm, then intervals/morphology, then axis.',
      },
    ];

    function renderStepH() {
      const quiz = renderQuiz({ questions: finalQuestions, storageKey: 'final', minPctToPass: 0.8 });
      const summary = el('div', { class: 'ekg-card' }, [
        el('div', { class: 'ekg-card-title', text: 'Summary' }),
        el('p', { class: 'ekg-card-text', text: 'Review your weak areas and repeat specific steps as needed.' }),
      ]);

      const score = state.results?.final?.score;
      if (score) {
        const passed = Boolean(state.results?.final?.passed);
        summary.appendChild(
          el('div', {
            class: `ekg-output ${passed ? 'success' : 'error'}`,
            text: `Final quiz: ${score.correct}/${score.total} (${formatPct(score.pct)}). ${passed ? 'Passed.' : 'Retry recommended.'}`,
          })
        );
        const next = passed ? 'You’re ready to practice with the Single-Lead Rhythm Simulator on the right.' : 'Revisit steps A–F, then retry.';
        summary.appendChild(el('p', { class: 'ekg-card-text', text: next }));
      } else {
        summary.appendChild(el('div', { class: 'ekg-output', text: 'Complete the final quiz to see your summary.' }));
      }

      return el('div', { class: 'ekg-step-body' }, [quiz, summary]);
    }

    function renderStep() {
      const title = stepTitles[state.stepIndex];
      const stepLabel = `Step ${stepIds[state.stepIndex]}: ${title}`;
      const head = el('div', { class: 'ekg-step-head' }, [
        el('div', { class: 'ekg-step-label', text: stepLabel }),
        el('div', { class: 'ekg-step-tags' }, [
          state.results?.stepC?.passed ? el('span', { class: 'ekg-tag success', text: 'Step C passed' }) : null,
          state.results?.final?.passed ? el('span', { class: 'ekg-tag success', text: 'Final passed' }) : null,
        ]),
      ]);

      let body = null;
      if (state.stepIndex === 0) body = renderStepA();
      else if (state.stepIndex === 1) body = renderStepB();
      else if (state.stepIndex === 2) body = renderStepC();
      else if (state.stepIndex === 3) body = renderStepD();
      else if (state.stepIndex === 4) body = renderStepE();
      else if (state.stepIndex === 5) body = renderStepF();
      else if (state.stepIndex === 6) body = renderStepG();
      else body = renderStepH();

      return el('div', {}, [head, body]);
    }

    function updateStepper() {
      progressText.textContent = `${state.stepIndex + 1} / ${stepTitles.length}`;
      backBtn.disabled = state.stepIndex === 0;
      nextBtn.disabled = state.stepIndex === stepTitles.length - 1;
    }

    function render() {
      hideTooltip();
      content.innerHTML = '';
      content.appendChild(renderStep());
      updateStepper();
    }

    backBtn.addEventListener('click', () => {
      state.stepIndex = clamp(state.stepIndex - 1, 0, stepTitles.length - 1);
      persist();
      render();
    });

    nextBtn.addEventListener('click', () => {
      state.stepIndex = clamp(state.stepIndex + 1, 0, stepTitles.length - 1);
      persist();
      render();
    });

    restartBtn.addEventListener('click', () => {
      safeStorage.clear();
      state.stepIndex = 0;
      state.results = {};
      state.guidedRegionIndex = 0;
      persist();
      render();
    });

    render();
    return { root, state };
  }

  window.initEkgTutorial = initEkgTutorial;
})();
