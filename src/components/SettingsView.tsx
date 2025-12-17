import { useEffect, useState } from 'react';
import type { Settings, CustomProvider, ProviderConfig } from '../lib/storage';
import { getSettings, saveSettings } from '../lib/storage';
import { mcpService } from '../lib/mcp';
import { Save, Key, Trash2, Pin, ChevronDown, ChevronRight, Plus, Check, X } from 'lucide-react';
import { ProviderLogo } from './ProviderLogo';

interface SettingsViewProps {
    onBack: () => void;
}

export const SettingsView = ({ onBack }: SettingsViewProps) => {
    const [settings, setSettings] = useState<Settings | null>(null);
    const [newServerUrl, setNewServerUrl] = useState('');
    const [showPinGuide, setShowPinGuide] = useState(false);

    // UI State for Provider List
    const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
    const [editingProviderSettings, setEditingProviderSettings] = useState<ProviderConfig | null>(null);
    const [saveStatus, setSaveStatus] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({});

    // Custom Provider Addition
    const [isAddingProvider, setIsAddingProvider] = useState(false);
    const [newProviderName, setNewProviderName] = useState('');

    // Custom Model Addition (Local state for the expanded provider)
    const [newCustomModelName, setNewCustomModelName] = useState('');

    // State for connection statuses (Polled from McpService)
    const [connectionStatuses, setConnectionStatuses] = useState<Record<string, string>>({});

    // State for viewing tools of a specific server
    const [expandedServer, setExpandedServer] = useState<string | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [serverTools, setServerTools] = useState<any[]>([]);

    const handleToggleServerTools = async (url: string) => {
        if (expandedServer === url) {
            setExpandedServer(null);
            setServerTools([]);
        } else {
            setExpandedServer(url);
            setServerTools([]); // Reset first
            // Fetch tools
            const tools = await mcpService.getToolsForServer(url);
            setServerTools(tools);
        }
    };

    // Poll for MCP connection status
    useEffect(() => {
        const checkStatus = () => {
            if (!settings?.mcpServers) return;
            const statuses: Record<string, string> = {};
            settings.mcpServers.forEach(s => {
                statuses[s.url] = mcpService.getConnectionStatus(s.url) || 'disconnected';
            });
            setConnectionStatuses(statuses);
        };

        // Initial check
        checkStatus();

        // Poll every 2 seconds
        const interval = setInterval(checkStatus, 2000);
        return () => clearInterval(interval);
    }, [settings?.mcpServers]);

    // Function to get status color
    const getStatusColor = (enabled: boolean, status: string) => {
        if (!enabled) return 'bg-gray-300 dark:bg-gray-600';
        switch (status) {
            case 'connected': return 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]';
            case 'connecting': return 'bg-yellow-500 animate-pulse';
            case 'error': return 'bg-red-500';
            default: return 'bg-gray-400';
        }
    };

    // Provider Logos component imported externally now

    // Predefined providers metadata (Only for naming display now, models moved to global constant)
    const STANDARD_PROVIDERS = [
        { id: 'openai', name: 'OpenAI', defaultBaseUrl: 'https://api.openai.com/v1' },
        { id: 'vivgrid', name: 'Vivgrid', defaultBaseUrl: 'https://api.vivgrid.com/v1' },
        { id: 'anthropic', name: 'Anthropic', defaultBaseUrl: 'https://api.anthropic.com/v1' },
        { id: 'google', name: 'Google', defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
        { id: 'deepseek', name: 'DeepSeek', defaultBaseUrl: 'https://api.deepseek.com/v1' },
        { id: 'grok', name: 'Grok', defaultBaseUrl: 'https://api.x.ai/v1' },
    ];

    useEffect(() => {
        getSettings().then(s => {
            setSettings(s);
            // Auto expand the active provider initially
            setExpandedProvider(s.provider);
            // Initialize local editing state for the active provider
            const activeConfig = s.providerSettings[s.provider] || { apiKey: '', model: '', baseUrl: '', customModels: [] };
            setEditingProviderSettings(activeConfig);
        });
    }, []);

    // Helper: Handle Auto-Save for Global Settings (General, MCP)
    const updateGlobalSetting = async (key: keyof Settings, value: any) => {
        if (!settings) return;
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        await saveSettings(newSettings);
    };

    const handleAddCustomProvider = async () => {
        if (!settings || !newProviderName.trim()) return;

        const newId = `custom_${Date.now()}`;
        const newProvider: CustomProvider = { id: newId, name: newProviderName.trim() };
        const newCustomProviders = [...(settings.customProviders || []), newProvider];

        // Initialize settings for new provider
        const newProviderSettings = {
            ...settings.providerSettings,
            [newId]: { apiKey: '', model: '', baseUrl: '', customModels: [] }
        };

        const newSettings = {
            ...settings,
            customProviders: newCustomProviders,
            providerSettings: newProviderSettings
        };

        setSettings(newSettings);
        await saveSettings(newSettings);

        setNewProviderName('');
        setIsAddingProvider(false);
        setExpandedProvider(newId);
        setEditingProviderSettings({ apiKey: '', model: '', baseUrl: '', customModels: [] });
    };

    const handleDeleteCustomProvider = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!settings || !confirm('Delete this provider?')) return;

        const newCustomProviders = settings.customProviders.filter(p => p.id !== id);

        // If deleting active provider, switch to openai
        let newActiveProvider = settings.provider;
        if (settings.provider === id) {
            newActiveProvider = 'openai';
        }

        const newSettings = {
            ...settings,
            customProviders: newCustomProviders,
            provider: newActiveProvider
        };

        setSettings(newSettings);
        await saveSettings(newSettings);

        if (expandedProvider === id) setExpandedProvider(null);
    };

    const handleSaveProvider = async (providerId: string) => {
        if (!settings || !editingProviderSettings) return;

        setSaveStatus(prev => ({ ...prev, [providerId]: 'saving' }));

        // Permission check for URL
        const currentUrl = editingProviderSettings.baseUrl;
        if (currentUrl && !currentUrl.includes('localhost') && !currentUrl.includes('127.0.0.1')) {
            try {
                const urlObj = new URL(currentUrl);
                const origin = `${urlObj.protocol}//${urlObj.hostname}/*`;
                await chrome.permissions.request({ origins: [origin] });
            } catch (e) {
                console.error("Permission request failed", e);
            }
        }

        const newProviderSettings = {
            ...settings.providerSettings,
            [providerId]: editingProviderSettings
        };

        // If this is the active provider, we also update the flat top-level fields for backward compatibility
        let newFlatSettings = {};
        if (settings.provider === providerId) {
            newFlatSettings = {
                apiKey: editingProviderSettings.apiKey,
                model: editingProviderSettings.model,
                baseUrl: editingProviderSettings.baseUrl
            };
        }

        const newSettings = {
            ...settings,
            ...newFlatSettings,
            providerSettings: newProviderSettings
        };

        setSettings(newSettings);
        await saveSettings(newSettings);

        setTimeout(() => setSaveStatus(prev => ({ ...prev, [providerId]: 'saved' })), 500);
        setTimeout(() => setSaveStatus(prev => ({ ...prev, [providerId]: 'idle' })), 2000);
    };

    const handleExpandProvider = (id: string) => {
        if (!settings) return;

        if (expandedProvider === id) {
            setExpandedProvider(null);
            setEditingProviderSettings(null);
        } else {
            setExpandedProvider(id);
            // Load settings for this provider into edit state
            const config = settings.providerSettings[id] || { apiKey: '', model: '', baseUrl: '', customModels: [] };
            setEditingProviderSettings(config);
            setNewCustomModelName(''); // Reset input
        }
    };

    const handleActivateProvider = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!settings) return;

        // Get config for the new provider
        const config = settings.providerSettings[id] || { apiKey: '', model: '', baseUrl: '', customModels: [] };

        const newSettings = {
            ...settings,
            provider: id,
            apiKey: config.apiKey,
            model: config.model,
            baseUrl: config.baseUrl
        };

        setSettings(newSettings);
        await saveSettings(newSettings);
    };

    const handleAddCustomModel = () => {
        if (!editingProviderSettings || !newCustomModelName.trim()) return;

        const updatedModels = [...(editingProviderSettings.customModels || []), newCustomModelName.trim()];
        setEditingProviderSettings({ ...editingProviderSettings, customModels: updatedModels });
        setNewCustomModelName('');
    };

    const handleDeleteCustomModel = (modelToDelete: string) => {
        if (!editingProviderSettings) return;
        const updatedModels = (editingProviderSettings.customModels || []).filter(m => m !== modelToDelete);
        setEditingProviderSettings({ ...editingProviderSettings, customModels: updatedModels });
    };

    // Combine standard and custom providers
    const allProviders = [
        ...STANDARD_PROVIDERS.map(p => ({ ...p, isCustom: false })),
        ...(settings?.customProviders || []).map(p => ({ id: p.id, name: p.name, isCustom: true, defaultBaseUrl: '' }))
    ];

    if (!settings) return <div className="p-4 text-center">Loading settings...</div>;

    return (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
            <h2 className="text-lg font-bold">Settings</h2>

            {/* General Settings */}
            <div className="space-y-4 pb-4 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">General</h3>

                {/* Context Toggle */}
                <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-sm font-medium flex items-center gap-2">
                            Allow Page Content Access
                        </span>
                        <span className="text-xs text-gray-500">Allow AI to read current page</span>
                    </div>
                    <button
                        onClick={async () => {
                            const newEnabled = !settings.enableContext;
                            // Request Permission logic duplicated for safety
                            if (newEnabled) {
                                try {
                                    const granted = await chrome.permissions.request({ origins: ['<all_urls>'] });
                                    if (granted) updateGlobalSetting('enableContext', true);
                                } catch (e) {
                                    console.error("Permission error", e);
                                    updateGlobalSetting('enableContext', true); // Fallback
                                }
                            } else {
                                updateGlobalSetting('enableContext', false);
                            }
                        }}
                        className={`w-10 h-5 rounded-full relative transition-colors ${settings.enableContext ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                    >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${settings.enableContext ? 'left-6' : 'left-1'}`} />
                    </button>
                </div>

                {/* Pin Guide */}
                <div className="flex flex-col gap-2">
                    <button
                        onClick={() => setShowPinGuide(!showPinGuide)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 w-fit"
                    >
                        <Pin size={12} className="rotate-45" />
                        How to Pin to Toolbar?
                    </button>

                    {showPinGuide && (
                        <div className="mt-1 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 text-sm">
                            <p className="font-medium mb-2 text-blue-800 dark:text-blue-300">How to pin SideAgent:</p>
                            <ol className="list-decimal list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-1">
                                <li>Click the <span className="font-bold">Extensions</span> icon (🧩) in your browser toolbar.</li>
                                <li>Find <span className="font-bold">SideAgent</span> in the list.</li>
                                <li>Click the <span className="font-bold">Pin</span> icon (<Pin size={12} className="inline rotate-45" />) next to it.</li>
                            </ol>
                        </div>
                    )}
                </div>
            </div>

            {/* Providers List */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">AI Provider</h3>
                    <button
                        onClick={() => setIsAddingProvider(true)}
                        className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                        <Plus size={14} /> Add Custom
                    </button>
                </div>

                {/* Add Custom Provider Input */}
                {isAddingProvider && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex gap-2">
                        <input
                            className="flex-1 text-sm bg-transparent outline-none"
                            placeholder="Provider Name (e.g. My Local LLM)"
                            value={newProviderName}
                            onChange={e => setNewProviderName(e.target.value)}
                            autoFocus
                        />
                        <button onClick={handleAddCustomProvider} disabled={!newProviderName.trim()} className="text-green-600 font-medium px-2 disabled:opacity-50">Add</button>
                        <button onClick={() => setIsAddingProvider(false)} className="text-gray-500 px-2">Cancel</button>
                    </div>
                )}

                <div className="space-y-2">
                    {allProviders.map(provider => {
                        const isExpanded = expandedProvider === provider.id;
                        const isActive = settings.provider === provider.id;

                        return (
                            <div key={provider.id} className={`rounded-lg border transition-all ${isExpanded ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 dark:border-gray-700'}`}>
                                {/* Header */}
                                <div
                                    className="p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-t-lg"
                                    onClick={() => handleExpandProvider(provider.id)}
                                >
                                    <ProviderLogo id={provider.id} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
                                    <div className="flex-1 flex items-center gap-2">
                                        <span className="font-medium text-sm">{provider.name}</span>
                                        {isActive && <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">Active</span>}
                                        {provider.isCustom && <span className="text-[10px] bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 px-2 py-0.5 rounded-full">Custom</span>}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {!isActive && (
                                            <button
                                                onClick={(e) => handleActivateProvider(provider.id, e)}
                                                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded text-gray-600 dark:text-gray-300 mr-2"
                                            >
                                                Use
                                            </button>
                                        )}
                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </div>
                                </div>

                                {/* Expanded Body */}
                                {isExpanded && editingProviderSettings && (
                                    <div className="p-3 pt-0 border-t border-gray-100 dark:border-gray-800 space-y-4 bg-gray-50/50 dark:bg-gray-900/50 rounded-b-lg">

                                        {/* API Key */}
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-gray-500">API Key</label>
                                            <div className="relative">
                                                <Key size={14} className="absolute left-2 top-2.5 text-gray-400" />
                                                <input
                                                    type="password"
                                                    value={editingProviderSettings.apiKey}
                                                    onChange={e => setEditingProviderSettings({ ...editingProviderSettings, apiKey: e.target.value })}
                                                    className="w-full pl-8 p-2 rounded border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 focus:border-blue-500 outline-none"
                                                    placeholder="sk-..."
                                                />
                                            </div>
                                        </div>

                                        {/* Base URL */}
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-gray-500">Base URL</label>
                                            <div className="relative">
                                                <ProviderLogo id={provider.id} className="absolute left-2 top-2.5 text-gray-400" />
                                                <input
                                                    type="text"
                                                    value={editingProviderSettings.baseUrl}
                                                    onChange={e => setEditingProviderSettings({ ...editingProviderSettings, baseUrl: e.target.value })}
                                                    className="w-full pl-8 p-2 rounded border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 focus:border-blue-500 outline-none"
                                                    placeholder={provider.defaultBaseUrl || "https://..."}
                                                />
                                            </div>
                                        </div>

                                        {/* Custom Models Manager */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-gray-500">Custom Models</label>
                                            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-2">
                                                {/* List */}
                                                <div className="flex flex-wrap gap-2 mb-2">
                                                    {(editingProviderSettings.customModels?.length > 0) ? editingProviderSettings.customModels.map(m => (
                                                        <span key={m} className="bg-gray-100 dark:bg-gray-700 text-xs px-2 py-1 rounded-full flex items-center gap-1 group">
                                                            {m}
                                                            <button
                                                                onClick={() => handleDeleteCustomModel(m)}
                                                                className="text-gray-400 hover:text-red-500"
                                                            >
                                                                <X size={10} />
                                                            </button>
                                                        </span>
                                                    )) : <span className="text-xs text-gray-400 italic">No custom models added.</span>}
                                                </div>

                                                {/* Add Input */}
                                                <div className="flex gap-2">
                                                    <input
                                                        className="flex-1 text-xs p-1 border-b border-gray-200 dark:border-gray-700 bg-transparent outline-none focus:border-blue-500"
                                                        placeholder="Add model ID (e.g. gpt-6)"
                                                        value={newCustomModelName}
                                                        onChange={e => setNewCustomModelName(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && handleAddCustomModel()}
                                                    />
                                                    <button
                                                        onClick={handleAddCustomModel}
                                                        disabled={!newCustomModelName.trim()}
                                                        className="text-blue-600 disabled:opacity-50"
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-gray-400">
                                                Note: Standard models are available by default in the chat menu. Add specific model IDs here if they are missing.
                                            </p>
                                        </div>

                                        {/* Actions Footer */}
                                        <div className="flex items-center justify-between pt-2">
                                            {provider.isCustom ? (
                                                <button
                                                    onClick={(e) => handleDeleteCustomProvider(provider.id, e)}
                                                    className="text-red-500 hover:text-red-600 text-xs flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50"
                                                >
                                                    <Trash2 size={14} /> Delete
                                                </button>
                                            ) : <div />} {/* Spacer */}

                                            <button
                                                onClick={() => handleSaveProvider(provider.id)}
                                                disabled={saveStatus[provider.id] === 'saving'}
                                                className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors text-white ${saveStatus[provider.id] === 'saved' ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'
                                                    }`}
                                            >
                                                {saveStatus[provider.id] === 'saved' ? <Check size={14} /> : <Save size={14} />}
                                                {saveStatus[provider.id] === 'saving' ? 'Saving...' : saveStatus[provider.id] === 'saved' ? 'Saved' : 'Save'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* MCP Configuration */}
            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">MCP Servers</h3>
                {/* Server List */}
                <div className="space-y-2">
                    {settings.mcpServers && settings.mcpServers.map((server, idx) => {
                        const status = connectionStatuses[server.url] || 'disconnected';

                        return (
                            <div key={idx} className="flex flex-col gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-300 transition-all">

                                <div className="flex items-center gap-2">
                                    {/* Status Dot */}
                                    <div
                                        className={`w-2 h-2 rounded-full transition-all ${getStatusColor(server.enabled, status)}`}
                                        title={`Status: ${status}${!server.enabled ? ' (Disabled)' : ''}`}
                                    />

                                    <span className="flex-1 text-xs truncate font-mono text-gray-600 dark:text-gray-300">
                                        {server.url}
                                    </span>

                                    {/* Toggle */}
                                    <button
                                        onClick={() => {
                                            if (!settings) return;
                                            const newServers = [...settings.mcpServers];
                                            newServers[idx].enabled = !newServers[idx].enabled;
                                            updateGlobalSetting('mcpServers', newServers);
                                        }}
                                        className={`text-[10px] px-2 py-0.5 rounded border ${server.enabled
                                            ? 'bg-blue-100 text-blue-700 border-blue-200'
                                            : 'bg-gray-100 text-gray-500 border-gray-200'
                                            }`}
                                    >
                                        {server.enabled ? 'ON' : 'OFF'}
                                    </button>

                                    {/* Delete */}
                                    <button
                                        onClick={() => {
                                            if (!settings) return;
                                            const newServers = settings.mcpServers.filter((_, i) => i !== idx);
                                            updateGlobalSetting('mcpServers', newServers);
                                        }}
                                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>

                                {/* Optional Name Input */}
                                <div className="flex items-center gap-2 pl-4">
                                    <label className="text-[10px] text-gray-400">Name:</label>
                                    <input
                                        type="text"
                                        value={server.name || ''}
                                        placeholder="Optional category (e.g. Finance)"
                                        className="flex-1 text-[10px] bg-transparent border-b border-gray-200 dark:border-gray-700 focus:border-blue-500 outline-none p-0.5 text-gray-600 dark:text-gray-400"
                                        onChange={(e) => {
                                            if (!settings) return;
                                            const newServers = [...settings.mcpServers];
                                            newServers[idx].name = e.target.value;
                                            updateGlobalSetting('mcpServers', newServers);
                                        }}
                                    />
                                </div>

                                {/* Error Message */}
                                {status === 'error' && (
                                    <div className="pl-4 text-[10px] text-red-500 font-mono break-all">
                                        Error: {mcpService.getConnectionError(server.url) || 'Unknown error'}
                                    </div>
                                )}

                                {/* Tools Toggle & List */}
                                <div className="pl-4">
                                    <button
                                        onClick={() => handleToggleServerTools(server.url)}
                                        disabled={status !== 'connected'}
                                        className="text-[10px] text-blue-500 hover:underline flex items-center gap-1 disabled:text-gray-400 disabled:no-underline"
                                    >
                                        {expandedServer === server.url ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                        {expandedServer === server.url ? 'Hide Tools' : 'View Tools'}
                                    </button>

                                    {expandedServer === server.url && (
                                        <div className="mt-2 space-y-2">
                                            {serverTools.length === 0 ? (
                                                <div className="text-[10px] text-gray-400 italic">No tools found (or loading...)</div>
                                            ) : (
                                                serverTools.map((tool, tIdx) => (
                                                    <div key={tIdx} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-2 rounded text-[10px]">
                                                        <div className="font-mono font-medium text-gray-700 dark:text-gray-300">{tool.name}</div>
                                                        <div className="text-gray-500 truncate">{tool.description}</div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Add New Server */}
                <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-500">Add Server (SSE)</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newServerUrl}
                            onChange={(e) => setNewServerUrl(e.target.value)}
                            placeholder="http://localhost:3000/sse"
                            className="flex-1 p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                        <button
                            disabled={!newServerUrl.trim()}
                            onClick={async () => {
                                if (!settings || !newServerUrl.trim()) return;

                                const urlStr = newServerUrl.trim();
                                try {
                                    const urlObj = new URL(urlStr);
                                    const origin = `${urlObj.protocol}//${urlObj.hostname}/*`;
                                    const originWithPort = urlObj.port ? `${urlObj.protocol}//${urlObj.hostname}:${urlObj.port}/*` : origin;
                                    const granted = await chrome.permissions.request({ origins: [originWithPort] });
                                    if (!granted) return;
                                } catch (e) {
                                    console.error("Invalid URL", e);
                                    return;
                                }

                                const newServers = [...(settings.mcpServers || []), { url: urlStr, enabled: true }];
                                updateGlobalSetting('mcpServers', newServers);
                                setNewServerUrl('');
                            }}
                            className="px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white rounded-lg text-xs font-medium hover:bg-black disabled:opacity-50"
                        >
                            Add
                        </button>

                    </div>
                </div>
            </div>

            <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
                <button onClick={onBack} className="text-sm text-gray-500 hover:underline">
                    Back to Chat
                </button>
            </div>
        </div >
    );
};
