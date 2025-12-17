// Include this script before </body> on every page to enable the global AI Tutor tab.
(function () {
    if (window.__aiTutorTabInitialized) return;
    window.__aiTutorTabInitialized = true;

    const PLAYLAB_EMBED_URL = 'https://www.playlab.ai/embedded/cmja4zdbb13e0oh0ufrywx9hw';
    const ROOT_ID = 'ai-tutor-root';
    const OPEN_CLASS = 'ai-tutor-open';
    let previousBodyOverflow = '';

    function injectStyles() {
        if (document.getElementById('ai-tutor-styles')) return;
        const style = document.createElement('style');
        style.id = 'ai-tutor-styles';
        style.textContent = `
#${ROOT_ID} {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
}
#${ROOT_ID}.${OPEN_CLASS}, #${ROOT_ID} .ai-tab {
  pointer-events: auto;
}
#${ROOT_ID} .ai-tab {
  position: fixed;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  pointer-events: auto;
  background: var(--surface, #111827);
  color: var(--text-on-surface, #f8fafc);
  border: none;
  border-radius: 999px 0 0 999px;
  padding: 12px 18px;
  font-weight: 700;
  font-size: 0.95rem;
  box-shadow: 0 10px 30px rgba(0,0,0,0.25);
  cursor: pointer;
  transition: transform 0.3s ease, box-shadow 0.3s ease, background 0.3s ease;
}
#${ROOT_ID} .ai-tab:hover {
  transform: translateY(-50%) scale(1.03);
  box-shadow: 0 14px 34px rgba(0,0,0,0.3);
}
#${ROOT_ID} .ai-tab {
  color: #f8fafc;
}
html[data-theme="light"] #${ROOT_ID} .ai-tab {
  background: #f8fafc;
  color: #0f172a;
  border: 1px solid rgba(15, 23, 42, 0.15);
}
#${ROOT_ID} .ai-panel {
  background: var(--surface, #0f172a);
  color: var(--text-on-surface, #f8fafc);
}
html[data-theme="light"] #${ROOT_ID} .ai-panel {
  background: #f8fafc;
  color: #0f172a;
  border-left: 1px solid rgba(15, 23, 42, 0.15);
}
#${ROOT_ID}.${OPEN_CLASS} .ai-tab {
  opacity: 0;
  pointer-events: none;
}
#${ROOT_ID} .ai-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}
#${ROOT_ID}.${OPEN_CLASS} .ai-overlay {
  opacity: 1;
  pointer-events: auto;
}
#${ROOT_ID} .ai-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: min(40vw, 520px);
  min-width: 300px;
  height: 100vh;
  box-shadow: -12px 0 30px rgba(0,0,0,0.35);
  transform: translateX(100%);
  transition: transform 0.35s ease;
  display: flex;
  flex-direction: column;
}
#${ROOT_ID}.${OPEN_CLASS} .ai-panel {
  transform: translateX(0);
}
#${ROOT_ID} .ai-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.3);
}
#${ROOT_ID} .ai-panel-header h3 {
  margin: 0;
  font-size: 1rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
#${ROOT_ID} .ai-close-btn {
  border: none;
  background: transparent;
  color: inherit;
  font-size: 1.4rem;
  cursor: pointer;
  padding: 4px;
}
#${ROOT_ID} .ai-panel-body {
  flex: 1;
  min-height: 0;
}
#${ROOT_ID} iframe {
  width: 100%;
  height: 100%;
  border: 0;
  background: transparent;
}
@media (max-width: 900px) {
  #${ROOT_ID} .ai-panel {
    width: 100vw;
  }
  #${ROOT_ID} .ai-tab {
    right: 6px;
  }
}
        `;
        document.head.appendChild(style);
    }

    function closePanel(root) {
        if (!root) return;
        root.classList.remove(OPEN_CLASS);
        document.removeEventListener('keydown', escListener);
        document.body.style.overflow = previousBodyOverflow;
    }

    function escListener(event) {
        if (event.key === 'Escape') {
            const root = document.getElementById(ROOT_ID);
            closePanel(root);
        }
    }

    function openPanel(root) {
        if (!root) return;
        previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        root.classList.add(OPEN_CLASS);
        document.addEventListener('keydown', escListener);
    }

    function buildUi() {
        if (document.getElementById(ROOT_ID)) return;
        injectStyles();

        const root = document.createElement('div');
        root.id = ROOT_ID;

        const tab = document.createElement('button');
        tab.className = 'ai-tab';
        tab.type = 'button';
        tab.textContent = 'AI Tutor';
        tab.addEventListener('click', () => openPanel(root));

        const overlay = document.createElement('div');
        overlay.className = 'ai-overlay';
        overlay.addEventListener('click', () => closePanel(root));

        const panel = document.createElement('div');
        panel.className = 'ai-panel';

        const header = document.createElement('div');
        header.className = 'ai-panel-header';

        const title = document.createElement('h3');
        title.textContent = 'AI Tutor';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'ai-close-btn';
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', 'Close AI Tutor');
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', () => closePanel(root));

        header.appendChild(title);
        header.appendChild(closeBtn);

        const body = document.createElement('div');
        body.className = 'ai-panel-body';

        const iframe = document.createElement('iframe');
        iframe.src = PLAYLAB_EMBED_URL;
        iframe.allow = 'clipboard-write';

        body.appendChild(iframe);
        panel.appendChild(header);
        panel.appendChild(body);

        root.appendChild(tab);
        root.appendChild(overlay);
        root.appendChild(panel);

        document.body.appendChild(root);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildUi);
    } else {
        buildUi();
    }
})();
