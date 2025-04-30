# Marco AI VS Code Extension

Marco AI is a VS Code extension that automates AI-assisted development workflows using GitHub Copilot. This extension provides a seamless, command-based automation interface without relying on UI image parsing.

## Features

- **Streamlined AI Workflow Controls**: Control your AI development workflow with simple Play/Pause/Stop controls in the status bar
- **Automated Git Branch Creation**: Optionally create a new feature branch when starting a workflow
- **Test Writing Automation**: Optionally include test-writing steps in your development workflow
- **Agent Status Monitoring**: Automatically check if the AI agent is still working and prompt if idle
- **Persistent Chat**: Ensures the Copilot Chat panel remains open during development

![Marco AI Controls](images/marco-ai-controls.png)

## Requirements

- Visual Studio Code v1.99.0 or higher
- GitHub Copilot and Copilot Chat extensions installed

## Extension Settings

This extension contributes the following settings:

* `marco.initCreateBranch`: When enabled, automatically creates a new Git branch when starting a workflow
* `marco.needToWriteTest`: When enabled, includes test-writing steps in the development workflow

## Usage

1. **Start a Workflow**: Click the Play button in the status bar or use the `Marco AI: Play` command
2. **Pause a Workflow**: Click the Pause button in the status bar or use the `Marco AI: Pause` command
3. **Stop a Workflow**: Click the Stop button in the status bar or use the `Marco AI: Stop` command

The extension will automatically interact with GitHub Copilot Chat to guide you through the development process.

## Development

### Building the Extension

1. Clone the repository
2. Run `npm install`
3. Press F5 to launch the extension in a new VS Code window

### Packaging

```
npm install -g vsce
vsce package
```

## Release Notes

### 0.0.1

Initial release of Marco AI with:
- Basic workflow controls
- Configurable Git branch creation
- Test writing automation support
- Agent status monitoring

---

## Contributing

Contributions are welcome! Feel free to submit issues or pull requests.

**Enjoy using Marco AI!**
