## Marco AI VS Code Extension Development Guide

This document outlines step-by-step instructions and example code snippets to build the **Marco AI** VS Code extension. It uses the VS Code Extension API to automate workflows without relying on UI image parsing.

---

### 1. Project Scaffold

1. Initialize a new extension:
   ```bash
   npm install -g yo generator-code
   yo code
   # Choose "TypeScript" + "New Extension (TypeScript)"
   ```
2. Open the generated folder in VS Code.
3. Install dependencies:
   ```bash
   npm install
   ```

---

### 2. Define Extension Commands

In `package.json`, declare the commands and configuration settings:

```jsonc
{
  "name": "marco-ai",
  "displayName": "Marco AI",
  "publisher": "your-name",
  "engines": { "vscode": "^1.80.0" },
  "activationEvents": [
    "onCommand:marco.play",
    "onCommand:marco.pause",
    "onCommand:marco.stop"
  ],
  "contributes": {
    "commands": [
      { "command": "marco.play",  "title": "Marco AI: Play"  },
      { "command": "marco.pause", "title": "Marco AI: Pause" },
      { "command": "marco.stop",  "title": "Marco AI: Stop"  }
    ],
    "configuration": {
      "type": "object",
      "title": "Marco AI Settings",
      "properties": {
        "marco.initCreateBranch": {
          "type": "boolean",
          "default": false,
          "description": "Enable branch creation in initial setup"
        },
        "marco.needToWriteTest": {
          "type": "boolean",
          "default": false,
          "description": "Include test-writing steps"
        }
      }
    }
  }
}
```

---

### 3. Activate and Register UI Controls

In `src/extension.ts`, register status-bar items for Play/Pause/Stop and bind commands:

```ts
import * as vscode from 'vscode';
import { runWorkflow } from './workflow';

export function activate(ctx: vscode.ExtensionContext) {
  const buttons = [
    { id: 'play',  icon: 'triangle-right', alignment: vscode.StatusBarAlignment.Left, priority: 100 },
    { id: 'pause', icon: 'debug-pause',     alignment: vscode.StatusBarAlignment.Left, priority:  99 },
    { id: 'stop',  icon: 'debug-stop',      alignment: vscode.StatusBarAlignment.Left, priority:  98 }
  ];

  buttons.forEach(btn => {
    const item = vscode.window.createStatusBarItem(btn.alignment, btn.priority);
    item.text        = `$(${btn.icon}) ${btn.id.charAt(0).toUpperCase() + btn.id.slice(1)}`;
    item.command     = `marco.${btn.id}`;
    item.tooltip     = `Marco AI ${btn.id.charAt(0).toUpperCase() + btn.id.slice(1)}`;
    item.show();
    ctx.subscriptions.push(item);
  });

  ['play', 'pause', 'stop'].forEach(action => {
    ctx.subscriptions.push(
      vscode.commands.registerCommand(`marco.${action}`, () => runWorkflow(ctx, action))
    );
  });

  // Optionally show/hide based on full-screen state
  vscode.window.onDidChangeWindowState(ws => {
    buttons.forEach(btn => {
      const item = vscode.window.createStatusBarItem();
      if (ws.fullScreen) item.show();
      else item.hide();
    });
  });
}

export function deactivate() {}
```

---

### 4. Workflow Orchestration

Create `src/workflow.ts` with functions to drive each step:

```ts
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export async function runWorkflow(ctx: vscode.ExtensionContext, action: string) {
  switch (action) {
    case 'play':
      await initialSetup(ctx);
      await developmentWorkflow(ctx);
      break;
    case 'pause':
      // pause/resume logic here
      break;
    case 'stop':
      // cleanup logic here
      break;
  }
}

async function initialSetup(ctx: vscode.ExtensionContext) {
  // 1) Open chat and send INIT.md
  await sendFileToChat('INIT.md');

  // 2) Branch creation
  const cfg = vscode.workspace.getConfiguration('marco');
  if (cfg.get<boolean>('initCreateBranch')) {
    await createAndCheckoutBranch();
    // wait for 'Continue' button in chat (handled via polling)
  }
}

async function developmentWorkflow(ctx: vscode.ExtensionContext) {
  const cfg = vscode.workspace.getConfiguration('marco');

  // Read checklist
  await sendFileToChat('CHECK_AGENT.md');

  if (cfg.get<boolean>('needToWriteTest')) {
    await sendFileToChat('WRITE_TESTS.md');
    await sendFileToChat('CHECK_AGENT.md');
  }

  // Verify completion
  await sendFileToChat('CHECK_CHECKLIST.md');
}

async function sendFileToChat(filename: string) {
  const file = path.join(__dirname, '..', filename);
  const content = fs.readFileSync(file, 'utf8');
  await openChat();
  await vscode.commands.executeCommand('github.copilot-chat.sendMessage', { message: content });
}

async function openChat() {
  await vscode.commands.executeCommand('github.copilot-chat.openChat');
}

async function createAndCheckoutBranch() {
  const gitExt = vscode.extensions.getExtension<any>('vscode.git')!.exports;
  const api    = gitExt.getAPI(1);
  const repo   = api.repositories[0];
  const branch = `feature/${Date.now()}`;

  await repo.createBranch(branch, true);
  vscode.window.showInformationMessage(`Checked out new branch: ${branch}`);
}
```

---

### 5. Polling and Monitoring

Add timers in `activate()` after registering commands:

```ts
// Every 10s: check agent alive
setInterval(() => {
  vscode.commands.executeCommand('marco.checkAgentAlive');
}, 10_000);

// Every 5min: ensure chat open
setInterval(async () => {
  const views = vscode.window.tabGroups.all;
  const chatOpen = views.some(g => g.tabs.some(t => t.label.includes('Copilot Chat')));
  if (!chatOpen) await openChat();
}, 5 * 60_000);
```  

Implement `checkAgentAlive` in `workflow.ts` to send a prompt if idle.

---

### 6. Configuration and User Settings

Expose your boolean flags under `contributes.configuration` in `package.json`. Users can toggle:

- `marco.initCreateBranch`
- `marco.needToWriteTest`

Retrieve them in code via `vscode.workspace.getConfiguration('marco').get<boolean>(...)`.

---

### 7. Packaging and Publishing

1. Update `README.md` with usage instructions.
2. Test locally: `F5` in VS Code to launch Extension Development Host.
3. Package:
   ```bash
   npm install -g vsce
   vsce package
   ```
4. Publish to the Marketplace:
   ```bash
   vsce publish
   ```


---

With these steps and code samples, your **Marco AI** extension will provide a seamless, command-based automation of VS Code without any image- or coordinate-based UI parsing.



# Marco AI Workflow (Abstracted)

## Initial Setup

1.  **Launch Program:** When the program starts, it activates an overlay displaying the current "Agent State" and providing controls (Play/Stop/Pause/Restart).
2.  **Initialize Interaction:** The program establishes a connection or interface for interacting with the agent.
3.  **Set Agent Mode:**
    *   Read the desired `agent_mode` (e.g., 'Agent', 'Edit', 'Ask') from the configuration.
    *   Ensure the agent is operating in the specified mode using the appropriate command or setting.
4.  **Select Agent LLM:**
    *   The preferred model order is: Claude 3.7 Sonnet > Gemini 2.5 > GPT 4.1.
    *   Configure the agent to use the highest-preferred model available from the list.
5.  **Initial Git Branch Setup (Conditional):**
    *   *IF* the user configuration `IS_INIT_CREATE_BRENCH` is `TRUE`:
        *   Instruct the agent to create and checkout a new Git branch based on a predefined task description (e.g., content previously in `NEW_BRENCH.md`).
        *   Wait for confirmation from the agent that the branch setup is complete.

## Development Workflow

1.  **Send Task (PROMPT):** Initiate the task by sending the initial checklist or task description (e.g., content previously in `INIT.md`) to the agent.
2.  **Agent Coding (ACTION):** The agent begins coding based on the provided instructions.
3.  **Check Agent Status (PROMPT):** Verify the agent's progress by sending a status check prompt (e.g., content previously in `CHECK_AGENT.md`).
4.  **Request Tests (Conditional PROMPT):**
    *   *IF* the user configuration `IS_NEED_TO_WRIGHT_TEST` is `TRUE`:
        *   Instruct the agent to write tests for the current feature.
5.  **Agent Writes Tests (Conditional ACTION):**
    *   *IF* `IS_NEED_TO_WRIGHT_TEST` is `TRUE`:
        *   The agent writes the requested tests.
6.  **Check Agent Status (Conditional PROMPT):**
    *   *IF* `IS_NEED_TO_WRIGHT_TEST` is `TRUE`:
        *   Verify the agent's progress again using a status check prompt.
7.  **Verify Checklist Completion (PROMPT):** Send a prompt to review the checklist status (e.g., content previously in `CHECK_CHECKLIST.md`). If incomplete, loop back to Step 1 of the Development Workflow.

## System Program Actions Defined

*   **Send Task:** Transmit the initial task description/checklist to the agent.
*   **Agent Coding:** No direct program action required; coding is initiated by the agent following the task prompt.
*   **Check Agent Status:** Send a predefined status inquiry prompt to the agent.
*   **Request Tests:** Send a predefined prompt instructing the agent to write tests.
*   **Verify Checklist Completion:** Send a predefined prompt asking the agent to confirm checklist completion status and potentially loop the workflow.

## Automated Monitoring

### Frequent Checks (Every 10 seconds)

*   **Check Agent Activity:**
    *   Use an internal mechanism (e.g., API status check, specific prompt) to determine if the agent is actively working.
    *   *If Idle:* Send a prompt like "Are you still working on the task?".

### Regular Checks (Every 5 minutes)

*   **Check Interaction Interface Status:**
    *   Verify if the agent interaction process or connection is active.
    *   *If Inactive/Closed:* Attempt to re-establish the connection or restart the process.

## Test Procedures

### PROMPT Tests (Agent Interaction)

1.  **If Agent Appears Stopped:**
    *   Ask: "Have you finished the current task?"
    *   *If YES:* Proceed to the next workflow state.
    *   *If NO:* Wait or prompt the agent to continue.
2.  **Check Feature Completion:**
    *   Ask: "Have you completed implementing the feature described in the checklist?"
    *   Analyze the agent's response.

### System Tests (Process/Connection Level)

1.  **Monitor Interaction Interface:**
    *   *If Inactive/Closed:* Attempt to reopen/re-establish the interface.
    *   *If Active:* No action.

### Error Handling (Agent Response Based)

1.  **Check for Errors in Agent Response:**
    *   Monitor agent responses for error indicators or failure messages.
    *   *If Error Detected:*
        *   Attempt to switch to the next preferred agent model.
        *   Continue the workflow, potentially re-sending the last prompt or asking for clarification.

## User Configuration Flags

*   `IS_INIT_CREATE_BRENCH` (Boolean): If `true`, create and checkout a new Git branch during initial setup.
*   `IS_NEED_TO_WRIGHT_TEST` (Boolean): If `true`, include steps for writing tests in the development workflow.