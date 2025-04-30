(function () {
    const vscode = acquireVsCodeApi();

    // Elements
    const toggleBtn = document.getElementById('toggleBtn');
    const toggleBtnText = document.getElementById('toggleBtnText');
    const pauseBtn = document.getElementById('pauseBtn');
    const restartBtn = document.getElementById('restartBtn');
    const statusIcon = document.getElementById('status-icon');
    const statusText = document.getElementById('status-text');
    const initCreateBranchCheckbox = document.getElementById('initCreateBranch');
    const needToWriteTestCheckbox = document.getElementById('needToWriteTest');
    const agentModeSelect = document.getElementById('agentMode');
    const taskDescriptionTextarea = document.getElementById('taskDescription');
    const saveTaskBtn = document.getElementById('saveTaskBtn');

    // State
    let isWorkflowRunning = false;
    let isPaused = false;

    // Icons for status
    const stateIcons = {
        'idle': 'debug-pause',
        'initializing': 'sync',
        'creating-branch': 'git-branch',
        'sending-task': 'arrow-right',
        'checking-status': 'question',
        'requesting-tests': 'beaker',
        'verifying-completion': 'checklist',
        'paused': 'debug-pause',
        'completed': 'check',
        'error': 'error'
    };

    // Request current configuration values
    vscode.postMessage({ type: 'getConfigValues' });

    // Event listeners
    toggleBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'toggleWorkflow' });
    });

    pauseBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'pauseWorkflow' });
        isPaused = !isPaused;
        pauseBtn.querySelector('span:last-child').textContent = isPaused ? 'Resume' : 'Pause';
        pauseBtn.querySelector('span.codicon').className = isPaused
            ? 'codicon codicon-debug-continue'
            : 'codicon codicon-debug-pause';
    });

    restartBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'restartWorkflow' });
    });

    initCreateBranchCheckbox.addEventListener('change', (e) => {
        vscode.postMessage({
            type: 'updateConfig',
            key: 'initCreateBranch',
            value: e.target.checked
        });
    });

    needToWriteTestCheckbox.addEventListener('change', (e) => {
        vscode.postMessage({
            type: 'updateConfig',
            key: 'needToWriteTest',
            value: e.target.checked
        });
    });

    agentModeSelect.addEventListener('change', (e) => {
        vscode.postMessage({
            type: 'updateConfig',
            key: 'agentMode',
            value: e.target.value
        });
    });

    saveTaskBtn.addEventListener('click', () => {
        const taskDescription = taskDescriptionTextarea.value.trim();
        if (taskDescription) {
            vscode.postMessage({
                type: 'userInput',
                value: taskDescription
            });
            saveTaskBtn.classList.add('saved');
            saveTaskBtn.querySelector('span:last-child').textContent = 'Saved';

            setTimeout(() => {
                saveTaskBtn.classList.remove('saved');
                saveTaskBtn.querySelector('span:last-child').textContent = 'Save Task';
            }, 2000);
        }
    });

    // Handle messages from the extension
    window.addEventListener('message', (event) => {
        const message = event.data;

        switch (message.type) {
            case 'configValues': {
                // Update UI with config values
                initCreateBranchCheckbox.checked = message.initCreateBranch;
                needToWriteTestCheckbox.checked = message.needToWriteTest;
                agentModeSelect.value = message.agentMode;

                if (message.workflowRunning) {
                    updateToggleButton(true);
                }
                break;
            }
            case 'stateUpdate': {
                updateState(message.state, message.isRunning, message.isPaused);
                break;
            }
            case 'workflowToggle': {
                updateToggleButton(message.isRunning);
                break;
            }
        }
    });

    /**
     * Update the toggle button state
     */
    function updateToggleButton(isRunning) {
        isWorkflowRunning = isRunning;

        if (isRunning) {
            toggleBtn.classList.add('stop');
            toggleBtnText.textContent = 'Stop Workflow';
            toggleBtn.querySelector('span.codicon').className = 'codicon codicon-debug-stop';
            pauseBtn.disabled = false;
        } else {
            toggleBtn.classList.remove('stop');
            toggleBtnText.textContent = 'Start Workflow';
            toggleBtn.querySelector('span.codicon').className = 'codicon codicon-debug-start';
            pauseBtn.disabled = true;
        }
    }

    /**
     * Update the workflow state in UI
     */
    function updateState(state, isRunning, isPaused) {
        // Update status indicator
        statusText.textContent = state.charAt(0).toUpperCase() + state.slice(1).replace(/-/g, ' ');
        statusIcon.className = `codicon codicon-${stateIcons[state] || 'question'}`;

        // Update progress steps
        const allSteps = document.querySelectorAll('.progress-step');
        let foundCurrentState = false;

        allSteps.forEach(step => {
            step.classList.remove('active', 'completed');

            const stepState = step.dataset.state;

            if (stepState === state) {
                step.classList.add('active');
                foundCurrentState = true;
            } else if (!foundCurrentState) {
                step.classList.add('completed');
            }
        });

        // Update button states
        updateToggleButton(isRunning);

        if (isPaused) {
            pauseBtn.querySelector('span:last-child').textContent = 'Resume';
            pauseBtn.querySelector('span.codicon').className = 'codicon codicon-debug-continue';
        } else {
            pauseBtn.querySelector('span:last-child').textContent = 'Pause';
            pauseBtn.querySelector('span.codicon').className = 'codicon codicon-debug-pause';
        }
    }
})();