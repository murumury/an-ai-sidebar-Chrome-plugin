import { useEffect, useState, useRef } from 'react';
import { SidebarHeader } from './components/SidebarHeader';
import { ChatInput } from './components/ChatInput';
import { HistoryView } from './components/HistoryView';
import { ChatMessage } from './components/ChatMessage';
import { SettingsView } from './components/SettingsView';
import { useChat } from '@ai-sdk/react';
import { Bot } from 'lucide-react';
// import { mockChatStream } from './lib/api'; // Disabling mock
import type { ChatSession, StoredMessage } from './lib/storage';
import { getActiveSessionId, setActiveSessionId, getSession, saveSession, getSessions, getSettings, deleteSession, clearAllSessions } from './lib/storage';
import { mcpService } from './lib/mcp';
import { runLLMStream } from './lib/llm';
import type { LLMMessage } from './lib/llm';

// Markdown Dependencies moved to ChatMessage
import 'highlight.js/styles/github-dark.css'; // Keep this for global styles if needed, or move to ChatMessage

// Define context structure
interface PageContext {
  title: string;
  content: string;
  url: string;
}

function App() {
  const [pageContext, setPageContext] = useState<PageContext | null>(null);
  const [contextEnabled, setContextEnabled] = useState(true);

  // App State
  const [view, setView] = useState<'chat' | 'history' | 'settings'>('chat');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionsList, setSessionsList] = useState<ChatSession[]>([]);
  const tabIdRef = useRef<number | null>(null);

  const [input, setInput] = useState('');

  // Initialize useChat
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { messages: rawMessages, setMessages } = useChat({
    onError: (err) => console.error("Chat error:", err),
  });

  // Normalize messages
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages = rawMessages as any[];

  // Dark Mode Auto-Detection
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (mediaQuery.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    // Initial check
    handleChange();

    // Listener
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // 1. Initialize & Handle Tab Switching
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      startNewChat(null, false);
      return;
    }

    const loadSessionForTab = async (tabId: number) => {
      tabIdRef.current = tabId;

      // 1. Get Context
      chrome.tabs.sendMessage(tabId, { action: 'GET_PAGE_CONTENT' }, (response: any) => {
        if (!chrome.runtime.lastError && response) {
          setPageContext(response);
        } else {
          setPageContext(null);
        }
      });

      // 2. Load Session
      const activeSessionId = await getActiveSessionId(tabId);
      if (activeSessionId) {
        const session = await getSession(activeSessionId);
        if (session) {
          setSessionId(session.id);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setMessages(session.messages as any[]);
          return;
        }
      }

      // If not found, start new
      startNewChat(tabId, false);
    };

    // Initial Load
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]?.id) loadSessionForTab(tabs[0].id);

      // Load and Connect MCP
      const settings = await getSettings();
      if (settings.mcpServers) {
        mcpService.syncServers(settings.mcpServers).catch(err => console.error("MCP Sync Error:", err));
      }
    });

    // Listener for Tab Switch
    const handleTabActivated = (activeInfo: { tabId: number; windowId: number }) => {
      loadSessionForTab(activeInfo.tabId);
    };

    // Listener for Tab Updates (Refresh/Navigation) to update Context
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleTabUpdated = (tabId: number, changeInfo: any) => {
      // We only care if the page finished loading ('complete') and it's our active tab
      if (tabId === tabIdRef.current && changeInfo.status === 'complete') {
        // Re-fetch context
        chrome.tabs.sendMessage(tabId, { action: 'GET_PAGE_CONTENT' }, (response: any) => {
          if (!chrome.runtime.lastError && response) {
            setPageContext(response);
          }
        });
      }
    };

    chrome.tabs.onActivated.addListener(handleTabActivated);
    chrome.tabs.onUpdated.addListener(handleTabUpdated);

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((chrome.tabs.onActivated as any).hasListener(handleTabActivated)) {
        chrome.tabs.onActivated.removeListener(handleTabActivated);
      }
      if (chrome.tabs.onUpdated.hasListener(handleTabUpdated)) {
        chrome.tabs.onUpdated.removeListener(handleTabUpdated);
      }
    };
  }, []);

  // 2. Persist Messages whenever they change
  useEffect(() => {
    if (!sessionId || messages.length === 0) return;

    const saveToStorage = async () => {
      let title = 'Untitled Chat';
      const firstUserMsg = messages.find((m: any) => m.role === 'user');
      if (firstUserMsg) {
        title = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '');
      }

      const session: ChatSession = {
        id: sessionId,
        title,
        updatedAt: Date.now(),
        messages: messages as StoredMessage[]
      };

      await saveSession(session);
    };

    const timeout = setTimeout(saveToStorage, 1000);
    return () => clearTimeout(timeout);
  }, [messages, sessionId]);

  const startNewChat = async (tabId: number | null, clearView = true) => {
    const newId = Date.now().toString();
    setSessionId(newId);

    const welcomeMsg = { id: 'welcome', role: 'assistant', content: 'Hello! I can help you with this page. Ask me anything.' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setMessages([welcomeMsg] as any[]);

    if (tabId && typeof chrome !== 'undefined') {
      await setActiveSessionId(tabId, newId);
      await saveSession({
        id: newId,
        title: 'New Chat',
        updatedAt: Date.now(),
        messages: [welcomeMsg as StoredMessage]
      });
    }

    if (clearView) setView('chat');
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selection
    if (confirm('Delete this chat?')) {
      await deleteSession(id);
      const sessions = await getSessions();
      setSessionsList(Object.values(sessions));

      // If deleted active session, start new
      if (sessionId === id) {
        startNewChat(tabIdRef.current);
      }
    }
  };

  const handleClearAll = async () => {
    if (sessionId) {
      await clearAllSessions(sessionId);
      // We only keep the current one, so list should be just one
      const sessions = await getSessions();
      setSessionsList(Object.values(sessions));
    } else {
      await clearAllSessions();
      setSessionsList([]);
      startNewChat(tabIdRef.current);
    }
  };

  // Helper: Trigger LLM with current messages
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // Helper: Trigger LLM with current messages
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const generateAIResponse = async (initialHistory: any[]) => {
    // We'll maintain a local history for this turn
    let currentHistory = [...initialHistory];

    // Create a placeholder for the INITIAL AI response (streaming)
    const aiMessageId = (Date.now() + 1).toString();
    const placeholder = { id: aiMessageId, role: 'assistant', content: '' };
    // Update UI immediately
    setMessages([...currentHistory, placeholder] as any[]);

    try {
      const settings = await getSettings();

      // 1. Fetch MCP Tools
      const mcpTools = await mcpService.listTools();
      const tools = mcpTools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema
        }
      }));

      // Loop for multi-step tool calls (Max 5 turns to prevent infinite loops)
      let turnCount = 0;
      const MAX_TURNS = 5;

      while (turnCount < MAX_TURNS) {
        turnCount++;

        // Prepare context for LLM
        let apiMessages: LLMMessage[] = currentHistory.map((m: any) => ({
          role: m.role as any,
          content: m.content || null,
          tool_calls: m.tool_calls,
          tool_call_id: m.tool_call_id,
          name: m.name
        }));

        if (contextEnabled && pageContext) {
          const systemMsg: LLMMessage = {
            role: 'system',
            content: `You are a helpful assistant. \n\nContext from current page "${pageContext.title}":\n${pageContext.content.slice(0, 8000)}`,
            tool_calls: undefined,
          };
          apiMessages = [systemMsg, ...apiMessages];
        }

        // Stream Response
        let currentContent = '';
        const finalMessage = await runLLMStream(
          apiMessages,
          settings,
          (chunk) => {
            // Only update the LAST assistant message if it's the one currently streaming
            // If we are in a tool loop, the UI should show the accumulated history
            // We mainly want to stream the "text" part of the *current* assistant turn
            currentContent += chunk;

            // Update the last message in UI
            // Note: This simple logic assumes the last message in currentHistory is the one being streamed
            // But in tool loops, we might be appending new messages.
            // Actually, for the initial turn, the placeholder is there.
            // For subsequent turns, we might need to add a new placeholder.

            // Let's refine: The UI state `messages` should reflect `currentHistory` + `currently streaming content`
            // BUT `currentHistory` doesn't contain the message being generated yet.

            // We can construct the "Full UI" messages list:

            // Simplified UI update: Just update the very last message of the "global" state? 
            // Problem: `setMessages` overwrites.

            // Strategy: Update local variable `currentContent` and force refresh UI
            // We'll append the *currently generating* message to `currentHistory` temporarily for UI render

            // Actually, let's keep it simple:
            // We will add the "Assistant" message to `currentHistory` ONLY after it finishes.
            // WHILE streaming, we merge it.

            const streamMsg = {
              id: `gen-${turnCount}`,
              role: 'assistant',
              content: currentContent
            };
            setMessages([...currentHistory, streamMsg] as any[]);
          },
          tools.length > 0 ? tools : undefined
        );

        // Turn Finished. 
        // 1. Add the Assistant Message (with content AND tool_calls) to history
        const assistantMsgForHistory = {
          role: 'assistant',
          content: finalMessage.content,
          tool_calls: finalMessage.tool_calls
        };
        // @ts-ignore
        currentHistory.push(assistantMsgForHistory);

        // Update UI to show this "committed" state (e.g. text + maybe hidden tool calls)
        setMessages([...currentHistory] as any[]);

        // 2. Check for Tool Calls
        if (finalMessage.tool_calls && finalMessage.tool_calls.length > 0) {
          console.log("Detected Tool Calls:", finalMessage.tool_calls);

          // Execute Tools
          for (const tc of finalMessage.tool_calls) {
            const toolName = tc.function.name;
            const argsStr = tc.function.arguments;
            let args = {};
            try { args = JSON.parse(argsStr); } catch (e) { console.error("JSON Parse error for tool args", e); }

            // UI Feedback: "Running tool..." (Maybe append a temporary system msg? or just let user wait)
            // Let's append a visual "Tool" message? 
            // ChatMessage component doesn't handle 'tool' role visually well yet, but we can try.
            // Ideally, we want to show "Used tool: X" like ChatGPT.

            // Execute
            let result = "Error executing tool";
            try {
              const res = await mcpService.callTool(toolName, args);
              result = JSON.stringify(res);
            } catch (e: any) {
              result = `Error: ${e.message}`;
            }

            // Append Tool Result to History
            currentHistory.push({
              role: 'tool',
              tool_call_id: tc.id,
              name: toolName,
              content: result
            } as any);
          }

          // Update UI again to show tool results (if we wanted to show them, currently ChatMessage might ignore 'tool' role which is good/hidden)
          // We continue the loop -> Run LLM again with "Tool Results" in history
        } else {
          // No tool calls -> Final response. Break.
          break;
        }
      }

    } catch (err: any) {
      console.error(err);
      const errorMessage = err.message || "An error occurred.";
      setMessages([...currentHistory, { id: 'error', role: 'assistant', content: `Error: ${errorMessage}` }] as any[]);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleInputChange = (e: any) => {
    setInput(e.target.value);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const manualSubmit = async (e: any) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { id: Date.now().toString(), role: 'user', content: input };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newHistory = [...messages, userMessage] as any[];

    setInput('');
    await generateAIResponse(newHistory);
  };

  const handleRetry = async (msgId: string) => {
    const index = messages.findIndex((m: any) => m.id === msgId);
    if (index === -1) return;

    // If retrying an AI message, we want to go back to the state BEFORE this AI message was generated.
    // So we keep everything up to index - 1.
    // But we need to make sure index-1 is a user message.
    if (messages[index].role === 'assistant') {
      const prevHistory = messages.slice(0, index); // Keep everything before the AI message
      await generateAIResponse(prevHistory);
    }
  };

  const handleEdit = async (msgId: string, newContent: string) => {
    const index = messages.findIndex((m: any) => m.id === msgId);
    if (index === -1) return;

    // If editing a User message
    if (messages[index].role === 'user') {
      const prevHistory = messages.slice(0, index); // Keep everything before this message
      const updatedUserMsg = { ...messages[index], content: newContent };
      const newHistory = [...prevHistory, updatedUserMsg];

      await generateAIResponse(newHistory);
    }
  };

  const loadHistory = async () => {
    const sessions = await getSessions();
    setSessionsList(Object.values(sessions));
    setView('history');
  };

  const selectSession = async (id: string) => {
    const session = await getSession(id);
    if (session) {
      setSessionId(session.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setMessages(session.messages as any[]);

      if (tabIdRef.current) {
        await setActiveSessionId(tabIdRef.current, session.id);
      }
      setView('chat');
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-white dark:bg-gray-900 overflow-hidden text-sm">
      <SidebarHeader
        onToggleHistory={() => view === 'history' ? setView('chat') : loadHistory()}
        onToggleSettings={() => view === 'settings' ? setView('chat') : setView('settings')}
        onNewChat={() => startNewChat(tabIdRef.current)}
        onClose={() => window.close()}
      />

      <div className="flex-1 overflow-hidden relative flex flex-col">
        {view === 'history' ? (
          <HistoryView
            sessions={sessionsList}
            onSelectSession={selectSession}
            onDeleteSession={handleDeleteSession}
            onClearAll={handleClearAll}
            currentSessionId={sessionId || undefined}
          />
        ) : view === 'settings' ? (
          <SettingsView onBack={() => setView('chat')} />
        ) : (
          <>
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto scroll-smooth pb-32">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <div className="bg-white/10 p-4 rounded-full mb-4">
                    <Bot size={48} />
                  </div>
                  <p className="text-lg font-medium">How can I help you today?</p>
                </div>
              )}
              {messages.map((m: any) => (
                <ChatMessage
                  key={m.id}
                  id={m.id}
                  role={m.role}
                  content={m.content}
                  onRetry={handleRetry}
                  onEdit={handleEdit}
                />
              ))}
            </div>

            {/* Input Area (Fixed Overlay) */}
            <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-white via-white to-transparent dark:from-gray-900 dark:via-gray-900 pb-4 pt-10 px-4 z-20">
              <ChatInput
                value={input}
                onChange={handleInputChange}
                onSubmit={manualSubmit}
                pageTitle={pageContext?.title}
                contextEnabled={contextEnabled}
                onToggleContext={() => setContextEnabled(!contextEnabled)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
