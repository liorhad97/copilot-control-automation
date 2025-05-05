<!-- # Marco AI Workflow (Abstracted)

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



 -->
