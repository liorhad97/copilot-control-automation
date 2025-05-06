# AI Agent Task Automation Framework

## I. Initialization Phase

### Program Launch & UI Activation
- The controlling program starts
- Overlay UI displays the current "Agent State" (Idle, Running, Paused)
- UI provides user controls (Play, Stop, Pause, Restart)

### Establish Agent Interface
- Program initializes connection with the designated AI agent service

### Configure Agent Mode
- **The copilot operates exclusively in 'Agent' mode**
- Program automatically checks current state
- System switches to 'Agent' mode if not already active
- Verification ensures proper configuration

### Select Agent LLM
- System identifies available Large Language Models
- Agent LLM selection follows priority order:
  1. Claude 3.7 Sonnet
  2. Gemini 2.5
  3. GPT 4.1
- Highest-priority available model is selected
- System switches models automatically if API errors occur

### Initial Git Branch Setup (Conditional)
- System checks IS_INIT_CREATE_BRENCH flag
- If TRUE:
  - Verifies user's Git login status
  - Instructs agent to create new branch with "_refactor" suffix
  - Executes Git commands from current branch
  - Waits for confirmation before proceeding

## II. Task Definition & Preparation

### Checklist File Verification
- System checks for CHECKLIST.txt in specified location
- If file doesn't exist:
  - Program halts main process
  - Opens VSCode interface for checklist creation
  - Provides text editor for user input
  - Creates new CHECKLIST.txt with user content
  - Continues normal flow after file creation

### Locate Checklist File
- Identifies primary CHECKLIST.txt file
- Verifies valid content and proper formatting

### Parse Checklist into Sub-Tasks
- Prompts AI agent to create JSON file
- Splits content into sub-tasks using >>> delimiter
- Trims whitespace from each sub-task
- Creates CHECKLIST.json with structured format:
  ```json
  {
      "tasks": [
          {
              "id": 1,
              "description": "Task 1 description here",
              "status": "pending"
          }
      ],
      "metadata": {
          "totalTasks": 0,
          "completedTasks": 0,
          "createdAt": "timestamp"
      }
  }
  ```
- Stores sub-tasks internally
- Saves JSON file for persistence

## III. Core Development Cycle

### Select Next Sub-Task
- Retrieves next pending sub-task from parsed checklist

### Send Sub-Task Prompt
- Sends current sub-task description to agent
- Provides context if helpful

### Agent Action: Coding/Implementation
- Agent processes the sub-task prompt
- Implements required changes

### Program Action: Check Agent Status
- Sends predefined status check prompt
- Analyzes agent's response for progress updates

### Program Action: Request Tests (Conditional)
- Checks IS_NEED_TO_WRITE_TEST flag
- If TRUE:
  - Sends prompt instructing agent to write tests

### Agent Action: Write Tests (Conditional)
- If prompted, agent writes necessary tests

### Program Action: Check Status After Tests (Conditional)
- If IS_NEED_TO_WRITE_TEST is TRUE:
  - Sends status check prompt again
  - Analyzes agent's response

### Program Action: Verify Sub-Task Completion
- Sends prompt to confirm task completion
- Updates sub-task status in CHECKLIST.json
- Updates metadata (increments "completedTasks")

### Program Action: Determine Next Action
- Checks for more pending sub-tasks
- If pending tasks exist:
  - Returns to "Select Next Sub-Task"
- Else:
  - Proceeds to Finalization Phase

## IV. Automated Monitoring

### Frequent Checks (Every 10 seconds)
- **Check Agent Activity:**
  - Uses internal mechanism to determine agent activity
  - If Idle: Sends prompt "Are you still working on the task?"

### Regular Checks (Every 5 minutes)
- **Check Chat Application Status:**
  - Uses OS-level checks to verify chat application window
  - If Closed: Attempts to relaunch application

### Test Procedures
- **PROMPT Tests (Agent Interaction)**
  1. If Agent Appears Stopped:
     - Asks: "Have you finished the current task?"
     - If YES: Proceeds to next workflow state
     - If NO: Waits or prompts agent to continue
  2. Check Feature Completion:
     - Asks: "Have you completed implementing the feature?"
     - Analyzes agent's response

- **OS Tests (System-Level)**
  1. Monitor Chat Application:
     - If Closed: Attempts to reopen application
     - If Open: No action

- **UI Tests (Visual Checks)**
  1. Check for Errors:
     - If Found:
       - Attempts to change agent model
       - Continues workflow, potentially re-prompting agent

## V. Finalization Phase

### Program Action: Final Status Report
- Generates comprehensive status report
- Displays report to user via UI

### Program Action: Cleanup & Shutdown
- Performs necessary cleanup actions
- Returns program to "Idle" state or shuts down

### Optional User Action: Export Results
- If requested, exports CHECKLIST.json and related logs