import { useEffect, useState, useRef } from 'react';
import { SidebarHeader } from './components/SidebarHeader';
import { ChatInput } from './components/ChatInput';
import { HistoryView } from './components/HistoryView';
import { ChatMessage } from './components/ChatMessage';
import { SettingsView } from './components/SettingsView';
import { useChat } from '@ai-sdk/react';
import { Zap } from 'lucide-react';
// import { mockChatStream } from './lib/api'; // Disabling mock
import type { ChatSession, StoredMessage } from './lib/storage';
import { getActiveSessionId, setActiveSessionId, getSession, saveSession, getSessions, getSettings, saveSettings, deleteSession, clearAllSessions } from './lib/storage';
import { mcpService } from './lib/mcp';
import { generateImage } from './lib/image-gen';
import { imageDB } from './lib/image-db';
import { FileProcessor } from './lib/file-processing';
import { runLLMStream } from './lib/llm';
import { skillsManager } from './lib/skills-manager';
import { skillsMatcher } from './lib/skills-matcher';
import type { SkillContent } from './lib/skills-storage';



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
  const [isContextEnabled, setIsContextEnabled] = useState(false);
  const [isWarningDismissed, setIsWarningDismissed] = useState(false);

  // App State
  const [view, setView] = useState<'chat' | 'history' | 'settings'>('chat');
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Ref to track active sessionId in async loops
  const sessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const [sessionsList, setSessionsList] = useState<ChatSession[]>([]);
  const tabIdRef = useRef<number | null>(null);

  // Settings State (Lifted for ChatInput access)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [settings, setSettings] = useState<any | null>(null);

  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false); // Track streaming state
  // Session-based Active Skills Map: { [sessionId]: ['skill1', 'skill2'] }
  const [sessionSkillsMap, setSessionSkillsMap] = useState<Record<string, string[]>>({});

  // Derived active skills for CURRENT session
  const activeSkills = (sessionId && sessionSkillsMap[sessionId]) || [];

  // Ref to signal stopping generation
  const stopRequestedRef = useRef(false);

  // Refs for auto-scroll during streaming
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);

  // Initialize useChat
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { messages: rawMessages, setMessages } = useChat({
    onError: (err) => {
      console.error("Chat error:", err);
      setIsStreaming(false);
    },
    onFinish: () => setIsStreaming(false)
  });

  // Normalize messages
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages = rawMessages as any[];

  // Auto-scroll to bottom during streaming (unless user scrolled up)
  useEffect(() => {
    if (isStreaming && !userScrolledUpRef.current && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  // Reset scroll flag when streaming starts
  useEffect(() => {
    if (isStreaming) {
      userScrolledUpRef.current = false;
    }
  }, [isStreaming]);

  // Handle user scroll to detect if they scrolled up
  const handleMessagesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!isStreaming) return;
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50;
    userScrolledUpRef.current = !isAtBottom;
  };

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

  // 2. Persist Messages whenever they change
  useEffect(() => {
    if (!sessionId || messages.length === 0) return;

    const saveToStorage = async () => {
      // optimization: Only save if there is at least one USER message
      const hasUserMessage = messages.some((m: any) => m.role === 'user');
      if (!hasUserMessage) return;

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
      setIsWarningDismissed(false); // Reset dismissal on tab load

      let activeSessionId = await getActiveSessionId(tabId);

      // Safety Check: If we are currently streaming for this exact session, DO NOT reload from storage
      // This prevents the "disappearing" bug where a background update (e.g. context fetch) 
      // triggers a reload that wipes out the in-memory streaming state.
      if (isStreaming && sessionIdRef.current && activeSessionId === sessionIdRef.current) {
        console.log("Skipping session load because streaming is active for this session.");
        return;
      }


      // 1. Get Context (Dynamic Injection)
      const settings = await getSettings();
      console.log("Loading Session for Tab:", tabId, "Enable Context:", settings.enableContext);
      setIsContextEnabled(settings.enableContext);
      if (settings.enableContext) {
        fetchPageContext(tabId);
      } else {
        setPageContext(null);
      }

      // 2. Load Session
      activeSessionId = await getActiveSessionId(tabId);
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
      setSettings(settings); // Init state
      setIsContextEnabled(settings.enableContext);
      // ... settings loading ...
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
    const handleTabUpdated = async (tabId: number, changeInfo: any) => {
      // We only care if the page finished loading ('complete') and it's our active tab
      if (tabId === tabIdRef.current && changeInfo.status === 'complete') {
        setIsWarningDismissed(false); // Reset dismissal on page refresh/update
        const settings = await getSettings();
        console.log("Tab Updated:", tabId, "Enable Context:", settings.enableContext);
        setIsContextEnabled(settings.enableContext);
        if (settings.enableContext) {
          fetchPageContext(tabId);
        } else {
          console.log("Context disabled in settings, skipping fetch.");
          setPageContext(null);
        }
      }
    };

    const fetchPageContext = async (tabId: number) => {
      try {
        console.log("Attempting to inject script into tab:", tabId);
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content.js']
        });
        console.log("Script injected. Sending GET_PAGE_CONTENT...");

        chrome.tabs.sendMessage(tabId, { action: 'GET_PAGE_CONTENT' }, (response: any) => {
          if (chrome.runtime.lastError) {
            console.error("Message passing error:", chrome.runtime.lastError.message);
            setPageContext(null);
            return;
          }
          console.log("Context Response:", response);
          if (response) {
            setPageContext(response);
          } else {
            console.warn("No response from content script.");
            setPageContext(null);
          }
        });
      } catch (err) {
        console.error("Context fetch failed (injection error?):", err);
        setPageContext(null);
      }
    };

    chrome.tabs.onActivated.addListener(handleTabActivated);
    chrome.tabs.onUpdated.addListener(handleTabUpdated);

    // Listener for Settings Changes to Sync MCP immediately
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes['user_settings']) {
        const newSettings = changes['user_settings'].newValue as any;
        setSettings(newSettings); // Update local state

        // Sync MCP
        if (newSettings?.mcpServers) {
          console.log("Settings changed, syncing MCP servers...");
          mcpService.syncServers(newSettings.mcpServers).catch(err => console.error("MCP Sync Error:", err));
        }

        // Sync Context (If enableContext changed)
        const oldSettings = changes['user_settings'].oldValue as any;
        if (newSettings?.enableContext !== oldSettings?.enableContext) {
          setIsContextEnabled(!!newSettings?.enableContext);
          if (tabIdRef.current) {
            // Re-run session load/context fetch
            loadSessionForTab(tabIdRef.current);
          }
        }
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((chrome.tabs.onActivated as any).hasListener(handleTabActivated)) {
        chrome.tabs.onActivated.removeListener(handleTabActivated);
      }
      if (chrome.tabs.onUpdated.hasListener(handleTabUpdated)) {
        chrome.tabs.onUpdated.removeListener(handleTabUpdated);
      }
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  // 2. Persist Messages whenever they change
  useEffect(() => {
    if (!sessionId || messages.length === 0) return;

    const saveToStorage = async () => {
      // optimization: Only save if there is at least one USER message
      const hasUserMessage = messages.some((m: any) => m.role === 'user');
      if (!hasUserMessage) return;

      let title = 'Untitled Chat';
      const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
      if (lastUserMsg) {
        title = lastUserMsg.content.slice(0, 30) + (lastUserMsg.content.length > 30 ? '...' : '');
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setMessages([] as any[]);

    if (tabId && typeof chrome !== 'undefined') {
      await setActiveSessionId(tabId, newId);
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


  // Helper: Trigger LLM with current messages
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const generateAIResponse = async (initialHistory: any[]) => {
    // Capture the session ID when this request started
    const startingSessionId = sessionId;
    if (!startingSessionId) return;

    // Reset stop signal
    stopRequestedRef.current = false;

    setIsStreaming(true);
    // We'll maintain a local history for this turn
    let currentHistory = [...initialHistory];
    const settings = await getSettings(); // Fetch settings first

    // Check for Image Generation Models
    const isImageModel = (
      settings.model.includes('dall-e') ||
      settings.model.includes('gpt-image') ||
      settings.model.includes('gemini') && settings.model.includes('image') || // Matches gemini-2.5-flash-image, etc.
      settings.model.includes('grok') && settings.model.includes('image')
    );

    if (isImageModel) {
      // Identify the prompt (last user message)
      const lastUserMsg = initialHistory[initialHistory.length - 1];
      if (!lastUserMsg || lastUserMsg.role !== 'user') {
        setIsStreaming(false);
        return;
      }

      // Create placeholder
      const aiMessageId = (Date.now() + 1).toString();
      const placeholder = { id: aiMessageId, role: 'assistant', content: '' };

      // Safety check before state update
      if (sessionIdRef.current === startingSessionId) {
        setMessages([...currentHistory, placeholder] as any[]);
      }

      try {
        const image = await generateImage(lastUserMsg.content, settings);
        await imageDB.saveImage(image);

        // Replace placeholder with final message
        const finalMsg = {
          id: image.id,
          role: 'assistant',
          content: `Here is your image for: "${image.prompt}"`,
          imageIds: [image.id]
        };

        currentHistory.push(finalMsg);

        if (sessionIdRef.current === startingSessionId) {
          setMessages([...currentHistory] as any[]);
        }
        await updateSessionInBackground(startingSessionId, currentHistory);

      } catch (err: any) {
        console.error("Image Gen Error:", err);
        const errorMsg = { id: 'error', role: 'assistant', content: `Error generating image: ${err.message}` };
        if (sessionIdRef.current === startingSessionId) {
          setMessages((prev: any[]) => [...prev.slice(0, -1), errorMsg]);
        }
        await updateSessionInBackground(startingSessionId, [...currentHistory, errorMsg]);
      } finally {
        if (sessionIdRef.current === startingSessionId) {
          setIsStreaming(false);
        }
      }
      return; // Exit, do not call simple LLM
    }

    try {
      // settings already fetched above

      // 1. Fetch MCP Tools
      const mcpTools = await mcpService.listTools();
      // Map sanitized name -> { originalName, serverUrl }
      const toolNameMap = new Map<string, { originalName: string, serverUrl?: string }>();

      const tools = mcpTools.map(t => {
        // Resolve a "Unique Name" for the LLM
        // If serverName is present, prefix it: ServerName_ToolName
        // Then sanitize everything.
        let uniqueName = t.name;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const serverName = (t as any).serverName; // Cast due to mixed type return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sourceUrl = (t as any).sourceUrl;

        if (serverName) {
          uniqueName = `${serverName}_${t.name}`;
        }

        // OpenAI requires function names to match /^[a-zA-Z0-9_-]+$/
        const validName = uniqueName.replace(/[^a-zA-Z0-9_-]/g, '_');

        toolNameMap.set(validName, { originalName: t.name, serverUrl: sourceUrl });

        return {
          type: 'function',
          function: {
            name: validName,
            // Append hint to description if serverName exists
            description: t.description + (serverName ? ` (Provided by ${serverName})` : ''),
            parameters: t.inputSchema || { type: 'object', properties: {} }
          }
        };
      });

      // Loop for multi-step tool calls (Max configured turns)
      let turnCount = 0;
      const effectiveMaxTurns = settings.maxTurns || 25;

      while (turnCount < effectiveMaxTurns) {
        turnCount++;

        // STOP only if explicitly requested. 
        // DO NOT stop if sessionIdRef changed (background streaming)
        if (stopRequestedRef.current) break;

        // --- PREPARE FOR STREAMING THIS TURN ---

        // 1. Create a placeholder for THIS TURN's AI response
        const aiMessageId = (Date.now() + turnCount).toString();
        const placeholder = { id: aiMessageId, role: 'assistant', content: '' };

        // Add placeholder to UI state (but not currentHistory yet, until finalized)
        if (sessionIdRef.current === startingSessionId) {
          setMessages((prev: any[]) => [...prev, placeholder]);
        }

        // 2. Prepare args for LLM
        // Global System Message
        let systemPrompt = "You are a Chrome extension AI assistant. You can read the current page's information if the user allows it, and you support using MCP tools provided by the user. When the user asks about the current page's content, prioritize using the 'Current Page Context' provided to you.";

        // Append Custom Instructions if Present
        if (settings.customInstructions && settings.customInstructions.trim()) {
          systemPrompt += `\n\n[CUSTOM INSTRUCTIONS]\n${settings.customInstructions.trim()}`;
        }

        // Pre-process history to inject attached files for the LLM (hidden from UI)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const processedHistory = currentHistory.map((m: any) => {
          // If message has attached files, append them to content
          if (m.attachedFiles && m.attachedFiles.length > 0) {
            let injected = m.content;
            injected += "\n\n--- ATTACHED FILES ---\n";
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            m.attachedFiles.forEach((f: any) => {
              injected += `\nFile: ${f.name}\n${f.content}\n--- End of ${f.name} ---\n`;
            });
            return { ...m, content: injected };
          }
          return m;
        });

        let messagesForLLM = [
          { role: 'system', content: systemPrompt },
          ...processedHistory
        ];

        // Inject Context if available
        if (pageContext) {
          const contextMsg = {
            role: 'system',
            content: `Current Page Context (Use this to answer questions about the page):\nTitle: ${pageContext.title}\nURL: ${pageContext.url}\nContent:\n${pageContext.content}`
          };
          messagesForLLM.splice(1, 0, contextMsg);
        }

        // Skills logic (Progressive Disclosure: only on first turn)
        let skillsActiveForThisTurn = false;
        if (turnCount === 1) {
          try {
            await skillsManager.initialize();
            const enabledSkills = await skillsManager.getEnabledSkills();
            if (enabledSkills.length > 0) {
              const lastUserMsg = [...processedHistory].reverse().find((m: { role: string }) => m.role === 'user');
              if (lastUserMsg) {
                const userMsgContent = typeof lastUserMsg.content === 'string' ? lastUserMsg.content : '';
                const matchedNames = await skillsMatcher.matchSkills(userMsgContent, enabledSkills);

                if (matchedNames.length > 0) {
                  setSessionSkillsMap(prev => ({ ...prev, [startingSessionId!]: matchedNames }));
                  skillsActiveForThisTurn = true;

                  const skillContents: SkillContent[] = [];
                  for (const name of matchedNames) {
                    const skill = await skillsManager.loadSkill(name);
                    if (skill) skillContents.push(skill);
                  }

                  if (skillContents.length > 0) {
                    const skillPrompt = skillContents
                      .map(s => `[Skill: ${s.name}]\n${s.instructions}`)
                      .join('\n\n---\n\n');

                    const skillsMsg = {
                      role: 'system',
                      content: `<skills>\n${skillPrompt}\n</skills>\n\n` +
                        `IMPORTANT: The above skill instructions contain all the knowledge you need to respond to this request. ` +
                        `Use the skill instructions directly to generate your response.`
                    };
                    messagesForLLM.splice(pageContext ? 2 : 1, 0, skillsMsg);
                  }
                } else {
                  setSessionSkillsMap(prev => {
                    const next = { ...prev };
                    if (startingSessionId) delete next[startingSessionId];
                    return next;
                  });
                }
              }
            } else {
              setSessionSkillsMap(prev => {
                const next = { ...prev };
                if (startingSessionId) delete next[startingSessionId];
                return next;
              });
            }
          } catch (skillError) {
            console.error('Skills matching error:', skillError);
            setSessionSkillsMap(prev => {
              const next = { ...prev };
              if (startingSessionId) delete next[startingSessionId];
              return next;
            });
          }
        }

        // WORKAROUND: Vivgrid Server System Prompt Overwrite
        if (settings.provider === 'vivgrid') {
          messagesForLLM = messagesForLLM.map(m => {
            if (m.role === 'system') {
              return { ...m, role: 'user', content: `[SYSTEM INSTRUCTION]\n${m.content}` };
            }
            return m;
          });
        }

        let fullContent = '';
        let fullReasoning = '';
        let toolCalls: any[] = [];
        let currentToolCall: any = null;

        // Run LLM
        const effectiveTools = skillsActiveForThisTurn ? [] : tools;
        const stream = runLLMStream(messagesForLLM as any, settings, effectiveTools);

        let lastSaveTime = 0;

        for await (const chunk of stream) {
          if (stopRequestedRef.current) break;

          if (chunk.type === 'content') {
            fullContent += chunk.content;
            // IMMUTABLE UPDATE with SAFETY CHECK
            if (sessionIdRef.current === startingSessionId) {
              setMessages((prev: any[]) => {
                if (prev.length === 0) return prev;
                const newMsgs = [...prev];
                const lastIndex = newMsgs.length - 1;
                const lastMsg = newMsgs[lastIndex];
                if (lastMsg.role === 'assistant') {
                  newMsgs[lastIndex] = { ...lastMsg, content: fullContent };
                }
                return newMsgs;
              });
            }

          } else if (chunk.type === 'reasoning') {
            fullReasoning += chunk.content;
            if (sessionIdRef.current === startingSessionId) {
              setMessages((prev: any[]) => {
                if (prev.length === 0) return prev;
                const newMsgs = [...prev];
                const lastIndex = newMsgs.length - 1;
                const lastMsg = newMsgs[lastIndex];
                if (lastMsg.role === 'assistant') {
                  newMsgs[lastIndex] = { ...lastMsg, reasoning_content: fullReasoning };
                }
                return newMsgs;
              });
            }

          } else if (chunk.type === 'tool_call_start') {
            if (currentToolCall) toolCalls.push(currentToolCall);
            currentToolCall = {
              id: chunk.toolCallId,
              name: chunk.name,
              arguments: ''
            };
          } else if (chunk.type === 'tool_call_delta') {
            if (currentToolCall) currentToolCall.arguments += chunk.args;
          }

          // Periodic Background Save (Throttled 1s)
          const now = Date.now();
          if (now - lastSaveTime > 1000) {
            lastSaveTime = now;
            const tempAssistantMsg = {
              id: aiMessageId,
              role: 'assistant',
              content: fullContent,
              reasoning_content: fullReasoning
            };
            await updateSessionInBackground(startingSessionId, [...currentHistory, tempAssistantMsg]);
          }
        }

        // Push the last tool call
        if (currentToolCall) {
          toolCalls.push(currentToolCall);
          currentToolCall = null;
        }

        // Finalize This Turn
        const assistantMsg: any = {
          role: 'assistant',
          content: fullContent,
          id: aiMessageId // Consistent ID
        };
        if (fullReasoning) assistantMsg.reasoning_content = fullReasoning;
        if (toolCalls.length > 0) {
          assistantMsg.tool_calls = toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: tc.arguments }
          }));
        }

        // Update HISTORY (Commit the turn)
        currentHistory.push(assistantMsg);

        // Immediate Save Final State
        await updateSessionInBackground(startingSessionId, currentHistory);

        // Sync UI if still active
        if (sessionIdRef.current === startingSessionId) {
          setMessages([...currentHistory] as any[]);
        }

        if (toolCalls.length === 0) break;

        // Execute Tools
        for (const tc of toolCalls) {
          if (stopRequestedRef.current) break;

          const mappedInfo = toolNameMap.get(tc.name);
          const originalName = mappedInfo ? mappedInfo.originalName : tc.name;
          const targetUrl = mappedInfo?.serverUrl;

          const toolMsg: any = {
            role: 'tool',
            tool_call_id: tc.id,
            name: tc.name,
            content: '',
            id: (Date.now() + Math.random()).toString()
          };
          currentHistory.push(toolMsg);

          if (sessionIdRef.current === startingSessionId) {
            setMessages([...currentHistory] as any[]);
          }
          await updateSessionInBackground(startingSessionId, currentHistory);

          let resultString = '';
          try {
            // ... parsing and execution ...
            const args = JSON.parse(tc.arguments || '{}');
            const result = await mcpService.callTool(originalName, args, targetUrl);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            resultString = (result.content as any[]).map((c: any) => c.type === 'text' ? c.text : '').join('\n');
            if (result.isError) resultString = `Error: ${resultString}`;
          } catch (err: any) {
            resultString = `Error executing tool: ${err.message}`;
          }

          toolMsg.content = resultString;
          // Update UI with tool result
          if (sessionIdRef.current === startingSessionId) {
            setMessages([...currentHistory] as any[]);
          }
          await updateSessionInBackground(startingSessionId, currentHistory);
        }
      }

    } catch (err: any) {
      console.error(err);
      if (sessionIdRef.current === startingSessionId) {
        const errorMessage = err.message || "An error occurred.";
        setMessages((prev: any[]) => [...prev, { id: 'error', role: 'assistant', content: `Error: ${errorMessage}` }]);
      }
      // Log error to background session too
      const errorMessage = err.message || "An error occurred.";
      await updateSessionInBackground(startingSessionId, [...currentHistory, { id: 'error', role: 'assistant', content: `Error: ${errorMessage}` }]);

    } finally {
      if (sessionIdRef.current === startingSessionId) {
        setIsStreaming(false);
      }
      setSessionSkillsMap(prev => {
        const next = { ...prev };
        if (startingSessionId) delete next[startingSessionId];
        return next;
      });
    }
  };

  // Helper to persist session in background without relying on UI state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateSessionInBackground = async (sid: string, msgs: any[]) => {
    try {
      // optimization: Only save if user msg exists
      const hasUserMessage = msgs.some((m: any) => m.role === 'user');
      if (!hasUserMessage) return;

      let title = 'Untitled Chat';
      const lastUserMsg = [...msgs].reverse().find((m: any) => m.role === 'user');
      if (lastUserMsg) {
        title = lastUserMsg.content.slice(0, 30) + (lastUserMsg.content.length > 30 ? '...' : '');
      }

      const session: ChatSession = {
        id: sid,
        title,
        updatedAt: Date.now(),
        messages: msgs as StoredMessage[]
      };

      await saveSession(session);

      // Also update local list if needed
      setSessionsList(prev => {
        const exists = prev.find(s => s.id === sid);
        if (exists) {
          return prev.map(s => s.id === sid ? session : s);
        }
        return [session, ...prev];
      });

    } catch (e) {
      console.error("Background Session Save Error:", e);
    }
  };


  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleInputChange = (e: any) => {
    setInput(e.target.value);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const manualSubmit = async (e: any, files?: File[]) => {
    e.preventDefault();
    if (!input.trim() && (!files || files.length === 0)) return;

    let attachedFiles: any[] = [];

    // Process Files if any
    if (files && files.length > 0) {
      try {
        // We split them here for the "hidden" prompt construction later
        // But we also want to store them for UI
        const rawFiles = await FileProcessor.readFiles(files);
        attachedFiles = rawFiles.map(f => ({
          name: f.name,
          content: FileProcessor.splitText(f.content).join('\n'), // Store full content for later injection
          size: f.content.length // Approximation or usage actual file.size from input? Input `files` has size.
        }));

        // Update sizes from original file objects for accuracy
        attachedFiles = attachedFiles.map((af, i) => ({
          ...af,
          size: files[i].size
        }));

      } catch (err) {
        console.error("File processing error:", err);
        // Optionally notify user
      }
    }

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      attachedFiles: attachedFiles.length > 0 ? attachedFiles : undefined
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newHistory = [...messages, userMessage] as any[];

    setInput('');
    // Synchronize UI immediately
    setMessages(newHistory);
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
      // Synchronize UI immediately to remove the old assistant message and anything after
      setMessages(prevHistory as any[]);
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

      // Synchronize UI immediately to update user message and remove old subsequent messages
      setMessages(newHistory as any[]);
      await generateAIResponse(newHistory);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    setMessages((prev: any[]) => prev.filter(m => m.id !== msgId));
    // The useEffect hook monitors `messages` and will auto-save the updated list.
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
            <div
              ref={messagesContainerRef}
              onScroll={handleMessagesScroll}
              className="flex-1 overflow-y-auto scroll-smooth pb-48"
            >
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                  <div className="bg-white-50 dark:bg-black-900/20 p-4 rounded-2xl mb-6">
                    <img src="/icon.png" alt="App Icon" className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2 text-gray-800 dark:text-gray-100">One Agent. Infinite Possibilities.</h2>
                  <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-xs">
                    Seamlessly integrates the latest Skills and MCP tools into your browser.
                  </p>

                  <div className="w-full max-w-sm space-y-3">
                    {[
                      "Summarize with custom prompt...",
                      "Call local API via MCP...",
                      "Run code analysis..."
                    ].map((text) => (
                      <button
                        key={text}
                        onClick={() => setInput(text)}
                        className="w-full p-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors shadow-sm"
                      >
                        {text}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m: any, index: number) => {
                const isLast = index === messages.length - 1;
                // Show border if:
                // 1. User message (always has border)
                // 2. Last message (bottom of chat)
                // 3. Next message is User (separation)
                // 4. (Implicitly) If next is tool/assistant, NO border (merge visually)
                const nextMsg = messages[index + 1];
                const showBorder = m.role === 'user' || isLast || (nextMsg && nextMsg.role === 'user');

                return (
                  <ChatMessage
                    key={m.id}
                    id={m.id}
                    role={m.role}
                    content={m.content}
                    reasoning={m.reasoning_content}
                    toolName={m.name}
                    onRetry={handleRetry}
                    onEdit={handleEdit}
                    onDelete={handleDeleteMessage}
                    isStreaming={isStreaming && isLast}
                    isGenerating={isStreaming}
                    isLast={isLast}
                    showBorder={showBorder}
                    imageIds={m.imageIds}
                    attachedFiles={m.attachedFiles}
                  />
                );
              })}
            </div>

            {/* Input Area (Fixed Overlay) */}
            <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-white via-white to-transparent dark:from-gray-900 dark:via-gray-900 pb-4 pt-10 px-4 z-20">
              {/* Skills Indicator */}
              {activeSkills.length > 0 && (
                <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-xs">
                  <Zap size={14} className="text-yellow-500" />
                  <span className="text-yellow-700 dark:text-yellow-400">
                    Using: {activeSkills.join(', ')}
                  </span>
                </div>
              )}
              <ChatInput
                value={input}
                onChange={handleInputChange}
                onSubmit={manualSubmit}
                pageTitle={pageContext?.title}
                contextEnabled={!!pageContext} // If we have context, it is enabled.
                isContextEnabledSetting={isContextEnabled}
                isWarningDismissed={isWarningDismissed}
                onDismissWarning={() => setIsWarningDismissed(true)}
                onToggleContext={() => {
                  // Optional: Allow temporary disable? For now, just link to settings or toggle settings?
                  // If user clicks this, maybe they want to DISABLE it?
                  // Let's make it toggle the setting for now for better UX
                  // Toggle from UI needs permission request too if enabling
                  getSettings().then(async s => {
                    const newEnabled = !s.enableContext;
                    if (newEnabled) {
                      try {
                        const granted = await chrome.permissions.request({ origins: ['<all_urls>'] });
                        if (granted) {
                          saveSettings({ ...s, enableContext: true });
                        }
                      } catch (e) {
                        console.error("Permission request error:", e);
                        saveSettings({ ...s, enableContext: true });
                      }
                    } else {
                      saveSettings({ ...s, enableContext: false });
                    }
                  });
                }}
                settings={settings}
                onUpdateSettings={async (newSettings) => {
                  setSettings(newSettings); // Optimistic UI update if we had a local state, but we rely on storage listener usually.
                  // Actually, for instant feedback, better to update local state passed down if we had one.
                  // But here we just save, and let storage listener update.
                  // Wait, `settings` variable is not in state in this component except locally in useEffect.
                  // We need to lift proper settings state or fetch it.
                  // Let's rely on saveSettings triggering the storage listener which updates `settings` if we add it to state.
                  // WAIT, we don't have a `settings` state in App component yet!
                  // I need to add `settings` state to App component first.
                  await saveSettings(newSettings);
                }}
                isStreaming={isStreaming}
                onStop={() => {
                  stopRequestedRef.current = true;
                  setIsStreaming(false);
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
