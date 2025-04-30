// @ts-check

/**
 * Client-side functionality for the Marco AI sidebar
 */
(function () {
    const vscode = acquireVsCodeApi();

    // DOM Elements
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');
    const restartBtn = document.getElementById('restartBtn');
    const backgroundModeCheckbox = document.getElementById('backgroundMode');
    const statusTextEl = document.getElementById('statusText');

    // Initial state
    let isRunning = false;
    let isPaused = false;
    updateUIFromState();

    // Get background mode setting from configuration
    vscode.postMessage({ command: 'getBackgroundMode' });

    // Event listeners
    playBtn.addEventListener('click', () => {
        vscode.postMessage({ command: 'play' });
    });

    pauseBtn.addEventListener('click', () => {
        vscode.postMessage({ command: 'pause' });
    });

    stopBtn.addEventListener('click', () => {
        vscode.postMessage({ command: 'stop' });
    });

    restartBtn.addEventListener('click', () => {
        vscode.postMessage({ command: 'restart' });
    });

    backgroundModeCheckbox.addEventListener('change', () => {
        vscode.postMessage({ 
            command: 'toggleBackground', 
            value: backgroundModeCheckbox.checked 
        });
    });

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
                backgroundModeCheckbox.checked = message.value;
                break;
        }
    });

    /**
     * Update UI elements based on current state
     */
    function updateUIFromState() {
        // Button visibility and text
        if (isRunning) {
            playBtn.style.display = 'none';
            stopBtn.style.display = 'inline-block';
            pauseBtn.style.display = 'inline-block';
            restartBtn.style.display = 'inline-block';
            
            if (isPaused) {
                pauseBtn.innerHTML = '<span class="icon play-icon">▶</span> Resume';
                statusTextEl.textContent = 'Paused';
                statusTextEl.classList.add('paused');
            } else {
                pauseBtn.innerHTML = '<span class="icon pause-icon">⏸</span> Pause';
                statusTextEl.textContent = 'Running';
                statusTextEl.classList.remove('paused');
                statusTextEl.classList.add('running');
            }
        } else {
            playBtn.style.display = 'inline-block';
            stopBtn.style.display = 'none';
            pauseBtn.style.display = 'none';
            restartBtn.style.display = 'none';
            statusTextEl.textContent = 'Idle';
            statusTextEl.classList.remove('running', 'paused');
        }
    }
})();
