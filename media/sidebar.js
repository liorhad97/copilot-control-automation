// @ts-check

/**
 * Client-side functionality for the Marco AI sidebar
 */

(function () {
    // VSCode API usage - declare it as any to avoid TypeScript errors
    // @ts-ignore
    const vscode = acquireVsCodeApi();

    // DOM Elements with proper type casting
    /** @type {HTMLButtonElement} */
    const playBtn = /** @type {HTMLButtonElement} */ (document.getElementById('playBtn'));
    /** @type {HTMLButtonElement} */
    const pauseBtn = /** @type {HTMLButtonElement} */ (document.getElementById('pauseBtn'));
    /** @type {HTMLButtonElement} */
    const stopBtn = /** @type {HTMLButtonElement} */ (document.getElementById('stopBtn'));
    /** @type {HTMLButtonElement} */
    const restartBtn = /** @type {HTMLButtonElement} */ (document.getElementById('restartBtn'));
    /** @type {HTMLInputElement} */
    const backgroundModeCheckbox = /** @type {HTMLInputElement} */ (document.getElementById('backgroundMode'));
    /** @type {HTMLElement} */
    const statusTextEl = /** @type {HTMLElement} */ (document.getElementById('statusText'));

    // Initial state
    let isRunning = false;
    let isPaused = false;
    updateUIFromState();

    // Get background mode setting from configuration
    vscode.postMessage({ command: 'getBackgroundMode' });

    // Event listeners with null checks
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'play' });
        });
    }

    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'pause' });
        });
    }

    if (stopBtn) {
        stopBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'stop' });
        });
    }

    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'restart' });
        });
    }

    if (backgroundModeCheckbox) {
        backgroundModeCheckbox.addEventListener('change', () => {
            vscode.postMessage({
                command: 'toggleBackground',
                value: backgroundModeCheckbox.checked
            });
        });
    }

    // Handle messages from extension
    window.addEventListener('message', (event) => {
        const message = event.data;

        switch (message.type) {
            case 'update-state':
                isRunning = message.data.isRunning;
                isPaused = message.data.isPaused;
                updateUIFromState();
                break;

            case 'background-mode':
                if (backgroundModeCheckbox) {
                    backgroundModeCheckbox.checked = message.value;
                }
                break;
        }
    });

    /**
     * Update UI elements based on current state
     */
    function updateUIFromState() {
        // Button visibility and text
        if (isRunning) {
            if (playBtn) playBtn.style.display = 'none';
            if (stopBtn) stopBtn.style.display = 'inline-block';
            if (pauseBtn) pauseBtn.style.display = 'inline-block';
            if (restartBtn) restartBtn.style.display = 'inline-block';

            if (isPaused) {
                if (pauseBtn) pauseBtn.innerHTML = '<span class="icon play-icon">▶</span> Resume';
                if (statusTextEl) {
                    statusTextEl.textContent = 'Paused';
                    statusTextEl.classList.add('paused');
                }
            } else {
                if (pauseBtn) pauseBtn.innerHTML = '<span class="icon pause-icon">⏸</span> Pause';
                if (statusTextEl) {
                    statusTextEl.textContent = 'Running';
                    statusTextEl.classList.remove('paused');
                    statusTextEl.classList.add('running');
                }
            }
        } else {
            if (playBtn) playBtn.style.display = 'inline-block';
            if (stopBtn) stopBtn.style.display = 'none';
            if (pauseBtn) pauseBtn.style.display = 'none';
            if (restartBtn) restartBtn.style.display = 'none';
            if (statusTextEl) {
                statusTextEl.textContent = 'Idle';
                statusTextEl.classList.remove('running', 'paused');
            }
        }
    }
})();
