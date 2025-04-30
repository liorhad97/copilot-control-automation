# Marco AI VS Code Extension

Marco AI is a VS Code extension that automates AI-assisted development workflows using GitHub Copilot. This extension provides a seamless, command-based automation interface without relying on UI image parsing.

## Features

- **Streamlined AI Workflow Controls**: Control your AI development workflow with simple Play/Pause/Stop/Restart controls in the status bar
- **Automated Git Branch Creation**: Optionally create a new feature branch when starting a workflow
- **Test Writing Automation**: Include test-writing steps in your development workflow
- **Agent Status Monitoring**: Automatically check if the AI agent is still working and prompt if idle
- **Persistent Chat**: Ensures the Copilot Chat panel remains open during development
- **AI Model Selection**: Choose your preferred AI model with a priority-based fallback system

## Architecture

The Marco AI extension follows a modular architecture with clear separation of concerns:

- **Services**: Focused modules handling specific functionality (Git, Prompts, Models)
- **Workflows**: Isolated workflow implementations for different stages (Setup, Development)
- **Utils**: Reusable utility functions and helpers
- **UI**: Status bar and UI-specific components
- **Monitoring**: Background monitoring for agent status and chat availability

## Requirements

- Visual Studio Code v1.99.0 or higher
- GitHub Copilot and Copilot Chat extensions installed

## Extension Settings

This extension contributes the following settings:

* `marco.initCreateBranch`: When enabled, automatically creates a new Git branch when starting a workflow
* `marco.needToWriteTest`: When enabled, includes test-writing steps in the development workflow
* `marco.idleTimeoutSeconds`: Timeout in seconds before considering the agent idle (default: 30)

## Usage

1. **Start a Workflow**: Click the Play button in the status bar or use the `Marco AI: Play` command
2. **Pause a Workflow**: Click the Pause button in the status bar or use the `Marco AI: Pause` command
3. **Stop a Workflow**: Click the Stop button in the status bar or use the `Marco AI: Stop` command
4. **Restart a Workflow**: Click the Restart button in the status bar or use the `Marco AI: Restart` command

The extension will automatically interact with GitHub Copilot Chat to guide you through the development process.

## Workflow Steps

### Initial Setup

1. The extension opens Copilot Chat and sends initial instructions
2. If enabled, it creates a new Git branch for the feature
3. The extension prepares the agent for development work

### Development Process

1. The extension sends the development checklist to the agent
2. The agent begins implementing the required features
3. The extension periodically checks the agent's status
4. If test writing is enabled, the extension requests tests after implementation
5. Finally, the extension verifies all checklist items are complete

### Monitoring

During the entire process, Marco AI monitors:

- Agent activity to detect if it becomes idle
- Chat panel availability to ensure it remains open
- Progress towards completion of all tasks

## Development

### Building the Extension

1. Clone the repository
2. Run `npm install`
3. Press F5 to launch the extension in a new VS Code window

### Packaging

```bash
npm install -g vsce
vsce package
```

## Release Notes

### 1.0.0

Initial release of Marco AI with:
- Modular architecture with clear separation of concerns
- Workflow controls (Play/Pause/Stop/Restart)
- Git branch creation
- Test writing automation
- Agent status monitoring
- AI model selection with priority-based fallback

---

## Contributing

Contributions are welcome! Feel free to submit issues or pull requests.

**Enjoy using Marco AI!**
