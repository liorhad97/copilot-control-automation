**User Note:** For defining tasks via a checklist, please use the provided text field in the VS Code interface. The program will capture your input directly from this interface.

## I. Initialization Phase

### Program Launch & UI Activation:
- The controlling program starts.
- A VS Code tab interface is displayed, showing the current "Agent State" (e.g., Idle, Running, Paused) and providing user controls (e.g., Play, Stop, Pause, Restart).

### Establish Agent Interface:
- The program initializes the connection or communication channel with the designated AI agent service.

### Configure Agent Mode:
- **The copilot can only operate in 'Agent' mode.**
- The program automatically checks if the current state is 'Agent' mode.
- If not in 'Agent' mode, the program will automatically change it to 'Agent' mode.
- Verification of successful mode change is performed to ensure proper configuration.

### Select Agent LLM:
- Identify the available Large Language Models (LLMs) supported by the agent interface.
- Select the agent's LLM based on the following prioritized preference order:
  1. Claude 3.7 Sonnet
  2. Gemini 2.5
  3. GPT 4.1
  Do this via API commands
- Configure the agent interface to use the highest-priority model from the list that is currently available and operational. If there is an API error, the program will change to the next available agent LLM.

### Initial Git Branch Setup (Conditional):
- Check the user configuration flag IS_INIT_CREATE_BRENCH.
- IF IS_INIT_CREATE_BRENCH is TRUE:
    - Verify that the user is logged in to their Git account. If not, prompt the user to login before proceeding.
    - Instruct the agent (via a specific prompt) to:
        - Create a new Git branch based on the current branch name with "_refactor" appended to it.
        - The branch will be created from the current branch the user is on.
        - Execute the branch creation using terminal commands (e.g., `git branch <current-branch-name>_refactor` followed by `git checkout <current-branch-name>_refactor`).
    - Wait for and verify a confirmation response from the agent indicating the branch setup was successful before proceeding.

## II. Task Definition & Preparation

### Checklist Input Capture:
- Present a VS Code tab interface with a text field for the user to input their checklist of tasks.
- Capture the user's input when they submit the form in this interface.
- If no input is provided, the program will not proceed with the main process.

### Parse Checklist into Sub-Tasks:
- Take the user's checklist input from the VS Code interface.
- Send the user's input to the AI agent to process and create a structured task list.
- The agent will analyze the input and create a JSON file named "CHECKLIST.json" with the following structure:
    ```json
    {
        "tasks": [
            {
                "id": 1,
                "description": "Task 1 description here",
                "status": "pending"
            },
            {
                "id": 2,
                "description": "Task 2 description here",
                "status": "pending"
            }
            // Additional tasks...
        ],
        "metadata": {
            "totalTasks": 0,
            "completedTasks": 0,
            "createdAt": "timestamp"
        }
    }
    ```
- Store these sub-tasks internally in the JSON structure, which will drive the development cycle.
- Save the JSON file to disk for persistence and potential later reference.

## III. Core Development Cycle (Iterates through Sub-Tasks)

This cycle processes each sub-task derived from the checklist.

### Select Next Sub-Task:
- Get the next pending sub-task from the parsed checkList.

### Send Sub-Task Prompt:
- Send the current sub-task description to the agent as the instruction prompt. Clearly indicate it's part of a larger checklist if helpful for context (e.g., "Complete the following task as part of the overall checklist: [sub-task description]").

### Agent Action: Coding/Implementation:
- The agent processes the sub-task prompt and implements the required changes. (Agent-internal action).

### Program Action: Check Agent Status (Status Prompt):
- Send a predefined status check prompt (e.g., content from CHECK_AGENT.txt configuration) to inquire about the agent's progress on the current sub-task.
- Analyze the agent's response for status updates.

### Program Action: Request Tests (Conditional Prompt):
- Check the user configuration flag IS_NEED_TO_WRITE_TEST.
- IF IS_NEED_TO_WRITE_TEST is TRUE:
  - Send a specific prompt instructing the agent to write tests for the code related to the completed sub-task.

### Agent Action: Write Tests (Conditional):
- IF IS_NEED_TO_WRITE_TEST was TRUE and the prompt was sent:
  - The agent processes the request and writes the necessary tests. (Agent-internal action).

### Program Action: Check Agent Status After Tests (Conditional Prompt):
- IF IS_NEED_TO_WRITE_TEST is TRUE:
  - Send the status check prompt again (Step III.4) to verify progress after the testing phase for the sub-task.
  - Analyze the agent's response.

### Program Action: Verify Sub-Task Completion (Verification Prompt):
- Send a specific prompt asking the agent to confirm if the current sub-task has been completed successfully.
- Based on the agent's response, update the sub-task status in the CHECKLIST.json file (e.g., change from "pending" to "completed").
- Update the metadata in CHECKLIST.json (e.g., increment "completedTasks").

### Program Action: Determine Next Action:
- Check if there are more pending sub-tasks in the CHECKLIST.json file.
- IF there are pending sub-tasks:
  - Return to Step III.1 (Select Next Sub-Task) to continue the development cycle with the next task.
- ELSE:
  - Proceed to Section IV (Finalization Phase).

## IV. Finalization Phase

### Program Action: Final Status Report:
- Generate a comprehensive status report summarizing the completion of all sub-tasks.
- Display the report to the user via the UI.

### Program Action: Cleanup & Shutdown:
- Perform any necessary cleanup actions (e.g., close connections, save final states).
- Return the program to "Idle" state or shut down as configured.

### Optional User Action: Export Results:
- If requested by the user, export the final CHECKLIST.json and any related logs or outputs to a specified location.