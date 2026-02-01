# SideAgent (Chrome Extension)

**SideAgent** is an advanced AI Sidebar for Chrome that bridges the gap between web browsing, local tools (MCP), and customizable AI skills. It's built for power users who want more than just a chat bot—they want an agent that can see the page, use tools, and adapt to specific workflows.

[![SideAgent - Open source AI sidebar with MCP & Skills support. | Product Hunt](https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1070734&theme=light)](https://www.producthunt.com/posts/sideagent?utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-sideagent)

![SideAgent](public/icon.png)

## ✨ Key Features

- **🧠 Context Awareness**: One-click access to the current page's content. Chat with any article, documentation, or PDF open in your browser.
- **⚡ Extensible Skills System**: Import custom "Skills" (Markdown files) to teach the AI specific tasks (e.g., "Code Reviewer", "Tweet Generator"). Skills automatically activate based on your intent.
- **🔌 MCP Support (Model Context Protocol)**: Connect to local tools and servers! Let the AI run scripts, access your file system, or query databases directly from the sidebar.
- **🎨 Multi-Modal Capabilities**: 
  - **Image Generation**: Generate images using DALL-E 3, Google Imagen, or Grok directly in the chat.
  - **File Analysis**: Drag & drop text/code files to analyze them alongside your conversation.
- **🚀 Multi-Provider Support**: 
  - **Cloud**: OpenAI, Google Gemini, DeepSeek, Anthropic, Grok, Vivgrid.
  - **Local**: Full support for **Ollama** (Llama 3, Mistral, Qwen, etc.).
  - **Custom**: Any OpenAI-compatible endpoint.
- **🛡️ Privacy Focused**: No middleman server. Your API keys and data stay in your browser's local storage.

## 🛠️ Installation & Development

### Prerequisites
- Node.js (v20+ recommended)
- npm or yarn

### Build Steps

1. **Clone & Install**:
   ```bash
   git clone https://github.com/murumury/an-ai-sidebar-Chrome-plugin.git
   cd an-ai-sidebar-Chrome-plugin
   npm install
   ```

2. **Build**:
   ```bash
   npm run build
   ```
   This generates a `dist` folder.

3. **Load in Chrome**:
   - Go to `chrome://extensions/`.
   - Enable **Developer mode** (top right).
   - Click **Load unpacked**.
   - Select the `dist` folder.

> **Tip**: For development with hot-reload, run `npm run dev` (note: requires browser reload for some changes).

## ⚙️ Configuration

### 1. AI Providers
Click the **Settings (Gear)** icon to configure your AI brain.
- **Standard**: Select OpenAI, DeepSeek, etc., and paste your API Key.
- **Ollama (Local)**:
  1. Start Ollama with CORS allowed: `OLLAMA_ORIGINS="*" ollama serve`
  2. In SideAgent Settings, choose **Custom / Other**.
  3. Base URL: `http://127.0.0.1:11434/v1`
  4. Model: `llama3` (or your installed model).

### 2. MCP Servers (Tools)
Extend the AI's reach beyond the browser.
1. Go to **Settings > MCP Servers**.
2. Add your local MCP server SSE endpoint (e.g., `http://localhost:3000/sse`).
3. Toggle servers on/off.
   > *Example: Connect a file-system MCP server to let SideAgent read/write files on your computer.*

### 3. Agent Skills ⚡
Skills are specialized instruction sets that the AI "equips" when needed. SideAgent implements the [Agent Skills Standard](https://agentskills.io) (originally from Anthropic), ensuring compatibility with the broader ecosystem.

- **Standardized Format**: A skill is a folder containing a `SKILL.md` file with YAML frontmatter (metadata) and Markdown instructions.
  ```markdown
  ---
  name: pdf-processing
  description: Extract text from PDFs. Use when user asks about PDF files.
  ---
  # Instructions
  1. ...
  ```
- **Progressive Disclosure**: SideAgent scans your skills but only loads the full instructions when relevant to your task, keeping context clean and fast.
- **Manage Skills**: Go to **Settings > Agent Skills** to manage or import skills.
- **Auto-Activation**: Just ask "Explain this code", and SideAgent automatically detects the intent and loads the `code-explainer` skill.

## 📖 Usage Guide

### Chatting & Context
- **Toggle Context**: Click the "File" icon above the input to let the AI read the current tab. (First use requires permission approval).
- **Attachments**: Click the paperclip or drag & drop text files to analyze them.

### Image Generation
- Select an image-capable model (e.g., `dall-e-3`, `gemini-2.5-flash-image`).
- Prompt: "Generate an image of a cyberpunk city."
- The image will appear directly in the chat history.

### Privacy Note
SideAgent is a **client-side** extension. 
- API calls go directly from your browser to the provider (OpenAI, DeepSeek, etc.).
- Your API keys are stored in `chrome.storage.local`.
- No tracking or analytics data is sent to the developer.

## 🤝 Contributing
Issues and Pull Requests are welcome! Please check `src/` for the React + Vite + Tailwind source code.

## License
MIT
