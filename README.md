# SideAgent (Chrome Extension)

SideAgent: Sidebar AI Assistant with MCP Client.


## Features

- **Context Awareness**: Automatically reads the content of the active tab to provide relevant answers.
- **Multi-Provider Support**: Supports OpenAI, Google Gemini, DeepSeek, Grok, and custom OpenAI-compatible endpoints.
- **MCP Support**: Integration with [Model Context Protocol](https://modelcontextprotocol.io/) to extend capabilities with local tools (e.g., executing scripts, file system access).
- **Rich Chat Interface**:
  - Markdown rendering with syntax highlighting for code blocks.
  - WeChat-style comfortable UI with dark mode support (follows system preference).
  - **DeepSeek Thinking**: Standardized UI for displaying reasoning chains.
- **Privacy Focused**: API keys and settings are stored locally in your browser.

## Installation & Development

### Prerequisites
- Node.js (v20+ recommended)
- npm or yarn

### Build Steps

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Build the Project**:
   ```bash
   npm run build
   ```
   This will generate a `dist` folder containing the compiled extension.

3. **Load in Chrome**:
   - Open Chrome and navigate to `chrome://extensions/`.
   - Enable **Developer mode** (toggle in the top right).
   - Click **Load unpacked**.
   - Select the `dist` folder from your project directory.

## Usage Guide

### 1. Opening the Sidebar
Click the extension icon (✨) in the Chrome toolbar to open the AI Sidebar. The sidebar will open as a native Chrome side panel.

### 2. Configuration (Settings)
Before using the chat, you need to configure your AI provider:
1. Click the **Settings (Gear)** icon in the top header.
2. Select your preferred **Provider** (e.g., OpenAI, DeepSeek).
3. Enter your **API Key**.
4. (Optional) Customize the Model and Temperature.
5. Click **Save Changes**.

### 3. Chatting
- Type your question in the input box at the bottom.
- Press **Enter** to send.
- Press **Shift + Enter** for a new line.
- **Context Toggle**: The "File" icon above the input box indicates if the current page content is included in the conversation. Click it to toggle context on/off.

### 4. MCP (Model Context Protocol)
This extension supports MCP to connect with local tools.
1. In Settings, scroll to the **MCP Servers** section.
2. Add your local MCP server URL (SSE endpoint).
3. Toggle servers on/off as needed.
The AI can then call tools provided by these servers during the conversation.

## 🦙 Local Model Support (Ollama)

You can run models locally using [Ollama](https://ollama.com/) and connect them to this extension.

### 1. Solve Connection Refused (403 Forbidden)
By default, Ollama restricts access from browser extensions for security. To allow the extension to connect, you must start Ollama with the `OLLAMA_ORIGINS` environment variable.

1. **Quit** any running Ollama instance (Click the icon in the menu bar -> Quit).
2. Open your Terminal.
3. Run the following command:

```bash
OLLAMA_ORIGINS="*" ollama serve
```

### 2. Configure Extension Settings
Once Ollama is running:

1. Open the AI Sidebar Settings.
2. Set **Provider** to `Custom / Other`.
3. Set **Base URL** to `http://127.0.0.1:11434/v1`.
   > **Note**: The `/v1` suffix is important for OpenAI-compatible mode.
4. Set **Model** to your installed model name (e.g., `qwen2.5:7b`, `llama3`).
   > Run `ollama list` in terminal to see available models.
5. Leave **API Key** empty.

## Troubleshooting

- **Extension not updating?** If you make code changes and rebuild (`npm run build`), you may need to click the **Reload** (refresh icon) on the extension card in `chrome://extensions/` to see the changes.
- **Changes usually require a build**: Most changes (React components, logic) require running `npm run build` to update the `dist` folder.



## 🚀 Vivgrid Integration (Optional)

You can enhance SideAgent with **Vivgrid** for geo-distributed inference and serverless MCP tools.

### 1. As an LLM Provider
Use Vivgrid's high-performance inference backend:
1.  **Provider**: Select `Vivgrid`.
2.  **Base URL**: `https://api.vivgrid.com/v1`.
3.  **API Key**: Enter your Vivgrid key.
4.  **Model**: `default`.


### 2. As an MCP Server Provider
Connect to Vivgrid's managed MCP runtime to use cloud tools (Weather, Web Search, etc.):
1.  In Settings, go to **MCP Servers**.
2.  Add Server: `https://api.vivgrid.com/mcp/v1/<your_mcp_id>/sse`.
3.  All cloud tools deployed on your Vivgrid account become instantly available.

> **Note**: Vivgrid allows you to deploy your own functions as MCP tools using [YoMo](https://yomo.run). See [Vivgrid Documentation](https://vivgrid.com) for deployment details.
