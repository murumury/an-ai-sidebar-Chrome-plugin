# AI Sidebar - Chrome Extension

A powerful, context-aware AI Sidebar for Chrome that allows you to chat with your current web page using various AI providers.

## Features

- **Context Awareness**: Automatically reads the content of the active tab to provide relevant answers.
- **Multi-Provider Support**: Supports OpenAI, Google Gemini, DeepSeek, Grok, and custom OpenAI-compatible endpoints.
- **MCP Support**: Integration with [Model Context Protocol](https://modelcontextprotocol.io/) to extend capabilities with local tools and servers.
- **Rich Chat Interface**:
    - Markdown rendering.
    - Syntax highlighting for code blocks.
    - WeChat-style comfortable UI.
    - Dark mode support (follows system preference).
- **Privacy Focused**: API keys and settings are stored locally in your browser.

## Installation & Development

### Prerequisites
- Node.js (v20+ recommended)
- npm or yarn

### Build Steps

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Build the Project**:
    ```bash
    npm run build
    ```
    This will generate a `dist` folder containing the compiled extension.

3.  **Load in Chrome**:
    - Open Chrome and navigate to `chrome://extensions/`.
    - Enable **Developer mode** (toggle in the top right).
    - Click **Load unpacked**.
    - Select the `dist` folder from your project directory.

## Usage Guide

### 1. Opening the Sidebar
Click the extension icon (✨) in the Chrome toolbar to open the AI Sidebar. The sidebar will open as a native Chrome side panel.

### 2. Configuration (Settings)
Before using the chat, you need to configure your AI provider:
1.  Click the **Settings (Gear)** icon in the top header.
2.  Select your preferred **Provider** (e.g., OpenAI, DeepSeek).
3.  Enter your **API Key**.
4.  (Optional) Customize the **Model** and **Temperature**.
5.  Click **Save Changes**.

### 3. Chatting
- Type your question in the input box at the bottom.
- Press **Enter** to send.
- Press **Shift + Enter** for a new line.
- **Context Toggle**: The "File" icon above the input box indicates if the current page content is included in the conversation. Click it to toggle context on/off.

### 4. MCP (Model Context Protocol)
This extension supports MCP to connect with local tools (e.g., executing scripts, file system access).
- In Settings, scroll to the **MCP Servers** section.
- Add your local MCP server URL (SSE endpoint).
- Toggle servers on/off as needed.
- The AI can then call tools provided by these servers during the conversation.

## Troubleshooting

- **Extension not updating?**
    If you make code changes and rebuild (`npm run build`), you may need to click the **Reload** (refresh icon) on the extension card in `chrome://extensions/` to see the changes.

- **Changes usually require a build:**
    Most changes (React components, logic) require running `npm run build` to update the `dist` folder.
