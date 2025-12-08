// Storage interface for Chat Sessions

export interface StoredMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface ChatSession {
    id: string;
    title: string;
    updatedAt: number;
    messages: StoredMessage[];
}

// Storage Keys
const SESSIONS_KEY = 'chat_sessions';
const TAB_SESSION_MAP_KEY = 'tab_session_map';

// Helper to get all sessions
export const getSessions = async (): Promise<Record<string, ChatSession>> => {
    if (typeof chrome === 'undefined' || !chrome.storage) return {} as Record<string, ChatSession>; // Dev fallback
    const result = await chrome.storage.local.get(SESSIONS_KEY);
    return (result[SESSIONS_KEY] || {}) as Record<string, ChatSession>;
};

// Helper to get a specific session
export const getSession = async (sessionId: string): Promise<ChatSession | null> => {
    const sessions = await getSessions();
    return sessions[sessionId] || null;
};

// Helper to save a session
export const saveSession = async (session: ChatSession) => {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    const sessions = await getSessions();
    sessions[session.id] = session;
    await chrome.storage.local.set({ [SESSIONS_KEY]: sessions });
};

// Helper to get the active session ID for a tab
export const getActiveSessionId = async (tabId: number): Promise<string | null> => {
    if (typeof chrome === 'undefined' || !chrome.storage) return null;
    const result = await chrome.storage.local.get(TAB_SESSION_MAP_KEY);
    const map = (result[TAB_SESSION_MAP_KEY] || {}) as Record<string, string>;
    return map[String(tabId)] || null;
};

// Helper to set the active session ID for a tab
export const setActiveSessionId = async (tabId: number, sessionId: string) => {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    const result = await chrome.storage.local.get(TAB_SESSION_MAP_KEY);
    const map = (result[TAB_SESSION_MAP_KEY] || {}) as Record<string, string>;
    map[String(tabId)] = sessionId;
    await chrome.storage.local.set({ [TAB_SESSION_MAP_KEY]: map });
};



export const deleteSession = async (sessionId: string): Promise<void> => {
    const sessions = await getSessions();
    if (sessions[sessionId]) {
        delete sessions[sessionId];
        await chrome.storage.local.set({ [SESSIONS_KEY]: sessions });
    }
};

export const clearAllSessions = async (excludeId?: string | null): Promise<void> => {
    if (!excludeId) {
        await chrome.storage.local.set({ [SESSIONS_KEY]: {} });
        return;
    }
    const sessions = await getSessions();
    const keptSession = sessions[excludeId];
    const newSessions = keptSession ? { [excludeId]: keptSession } : {};
    await chrome.storage.local.set({ [SESSIONS_KEY]: newSessions });
};

// --- Settings ---

export interface McpServerConfig {
    url: string;
    enabled: boolean;
}

export interface Settings {
    provider: string;
    apiKey: string;
    baseUrl?: string;
    model: string;
    temperature: number;
    mcpServers: McpServerConfig[];
}

const SETTINGS_KEY = 'user_settings';
const DEFAULT_SETTINGS: Settings = {
    provider: 'openai',
    apiKey: '',
    baseUrl: '',
    model: 'gpt-4o',
    temperature: 0.7,
    mcpServers: [],
};

export const getSettings = async (): Promise<Settings> => {
    if (typeof chrome === 'undefined' || !chrome.storage) return DEFAULT_SETTINGS;
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    const stored = result[SETTINGS_KEY] as Settings;

    // Defensive strategy: Ensure arrays are present even if stored object has undefined property
    const merged = { ...DEFAULT_SETTINGS, ...stored };
    if (!Array.isArray(merged.mcpServers)) {
        merged.mcpServers = DEFAULT_SETTINGS.mcpServers;
    }
    return merged;
};

export const saveSettings = async (settings: Settings) => {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
};
