import { useEffect, useState } from 'react';
import type { Settings } from '../lib/storage';
import { getSettings, saveSettings } from '../lib/storage';
import { Save, Key, Cpu, Thermometer, Globe, Trash2 } from 'lucide-react';

interface SettingsViewProps {
    onBack: () => void;
}

export const SettingsView = ({ onBack }: SettingsViewProps) => {
    const [settings, setSettings] = useState<Settings | null>(null);
    const [newServerUrl, setNewServerUrl] = useState('');
    const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    // Predefined providers
    const PROVIDERS = [
        { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
        { id: 'vivgrid', name: 'Vivgrid', baseUrl: 'https://api.vivgrid.com/v1', defaultModel: 'default' }, // Vivgrid might not need model
        { id: 'anthropic', name: 'Anthropic (via OpenAI Compatible)', baseUrl: 'https://api.anthropic.com/v1' }, // Placeholder, usually requires different SDK
        { id: 'google', name: 'Google (via OpenAI Compatible)', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
        { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com' },
        { id: 'grok', name: 'Grok (xAI)', baseUrl: 'https://api.x.ai/v1' },
        { id: 'custom', name: 'Custom / Other', baseUrl: '' },
    ];

    useEffect(() => {
        getSettings().then(setSettings);
    }, []);

    const handleSave = async () => {
        if (!settings) return;
        setStatus('saving');

        // Request Host Permission for Custom URL if needed
        const currentUrl = settings.baseUrl;
        if (currentUrl && !currentUrl.includes('localhost') && !currentUrl.includes('127.0.0.1')) {
            try {
                // Parse origin
                const urlObj = new URL(currentUrl);
                const origin = `${urlObj.protocol}//${urlObj.hostname}/*`;

                // Only request if not already granted? Chrome handles overlap.
                // Note: user gesture required. handleSave is clicked by user.
                const granted = await chrome.permissions.request({
                    origins: [origin]
                });

                if (!granted) {
                    // Warn but save? Or block?
                    console.warn("Permission not granted for", origin);
                    // We save anyway, but it might fail to fetch. User choice.
                }
            } catch (e) {
                console.error("Error requesting permission:", e);
                // Invalid URL or other error
            }
        }

        await saveSettings(settings);
        setTimeout(() => setStatus('saved'), 500);
        setTimeout(() => setStatus('idle'), 2000);
    };

    // Helper to update a setting. If it's a provider-specific setting, update both flat & nested.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateSetting = (key: keyof Settings, value: any) => {
        if (!settings) return;

        // Initialize nested object if missing (defensive)
        const currentProviderSettings = settings.providerSettings || {};
        const activeProviderConfig = currentProviderSettings[settings.provider] || { apiKey: '', model: '', baseUrl: '' };

        let newSettings = { ...settings, [key]: value };

        // If updating a provider-specific field (apiKey, model, baseUrl), also sync it to providerSettings
        if (['apiKey', 'model', 'baseUrl'].includes(key)) {
            newSettings.providerSettings = {
                ...currentProviderSettings,
                [settings.provider]: {
                    ...activeProviderConfig,
                    [key]: value
                }
            };
        }

        setSettings(newSettings);
    };

    const handleProviderChange = (providerId: string) => {
        if (!settings) return;

        // 1. Save current input values to the OLD provider's slot before switching
        const oldProvider = settings.provider;
        const updatedProviderSettings = {
            ...settings.providerSettings,
            [oldProvider]: {
                apiKey: settings.apiKey,
                model: settings.model,
                baseUrl: settings.baseUrl
            }
        };

        // 2. Load values for the NEW provider
        const newProviderConfig = updatedProviderSettings[providerId] || { apiKey: '', model: '', baseUrl: '' };

        // 3. Find default if not set? (Already handled by storage migration defaults, but good to be safe)
        const providerMeta = PROVIDERS.find(p => p.id === providerId);

        setSettings({
            ...settings,
            provider: providerId,
            providerSettings: updatedProviderSettings, // Save the old one
            // Set flat fields to new provider's values
            apiKey: newProviderConfig.apiKey,
            model: newProviderConfig.model || providerMeta?.defaultModel || '',
            baseUrl: newProviderConfig.baseUrl || providerMeta?.baseUrl || ''
        });
    };

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
                            if (newEnabled) {
                                // Request Broad Permission
                                try {
                                    const granted = await chrome.permissions.request({
                                        origins: ['<all_urls>']
                                    });
                                    if (granted) {
                                        setSettings({ ...settings, enableContext: true });
                                    } else {
                                        // User denied
                                        alert("Permission to read all pages was denied. Context features will be limited.");
                                        // Still enable? No, keep disabled.
                                    }
                                } catch (e) {
                                    console.error("Permission request failed:", e);
                                    // Fallback for dev mode or if request fails
                                    setSettings({ ...settings, enableContext: true });
                                }
                            } else {
                                // Disable
                                setSettings({ ...settings, enableContext: false });
                                // Optional: Remove permission? No need.
                            }
                        }}
                        className={`w-10 h-5 rounded-full relative transition-colors ${settings.enableContext ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                    >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${settings.enableContext ? 'left-6' : 'left-1'}`} />
                    </button>
                </div>
            </div>

            {/* Provider Selector */}
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium flex items-center gap-2">
                    <Globe size={16} />
                    Provider
                </label>
                <select
                    className="p-2 border rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 outline-none"
                    value={settings.provider || 'openai'}
                    onChange={(e) => handleProviderChange(e.target.value)}
                >
                    {PROVIDERS.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
            </div>

            {/* API Key */}
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium flex items-center gap-2">
                    <Key size={16} />
                    API Key
                </label>
                <input
                    type="password"
                    className="p-2 border rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="sk-..."
                    value={settings.apiKey}
                    onChange={(e) => updateSetting('apiKey', e.target.value)}
                />
                <p className="text-xs text-gray-500">
                    Your key is stored locally in your browser.
                </p>
            </div>

            {/* Base URL */}
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium flex items-center gap-2">
                    <Globe size={16} />
                    Base URL
                </label>
                <input
                    type="text"
                    className="p-2 border rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 outline-none"
                    placeholder="https://api.openai.com/v1"
                    value={settings.baseUrl || ''}
                    onChange={(e) => updateSetting('baseUrl', e.target.value)}
                />
                <p className="text-xs text-gray-500">
                    Defaults to https://api.openai.com/v1 if empty.
                </p>
            </div>

            {/* Model */}
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium flex items-center gap-2">
                    <Cpu size={16} />
                    Model
                </label>
                <input
                    type="text"
                    className="p-2 border rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 outline-none"
                    placeholder={settings.provider === 'vivgrid' ? 'Optional for Vivgrid' : 'gpt-4o'}
                    value={settings.model}
                    onChange={(e) => updateSetting('model', e.target.value)}
                />
                {/* Helper text for presets if useful, but simple input is versatile */}
            </div>

            {/* Temperature */}
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium flex items-center gap-2">
                    <Thermometer size={16} />
                    Temperature: {settings.temperature}
                </label>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    className="accent-blue-600"
                    value={settings.temperature}
                    onChange={(e) => updateSetting('temperature', parseFloat(e.target.value))}
                />
                <div className="flex justify-between text-xs text-gray-500">
                    <span>Precise (0.0)</span>
                    <span>Creative (1.0)</span>
                </div>
            </div>

            {/* MCP Configuration */}
            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">MCP Servers</h3>

                {/* Server List */}
                <div className="space-y-2">
                    {settings.mcpServers && settings.mcpServers.map((server, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-300 transition-all">
                            {/* Status Dot */}
                            <div
                                className={`w-2 h-2 rounded-full ${server.enabled ? 'bg-green-500' : 'bg-gray-400'}`}
                                title={server.enabled ? "Enabled" : "Disabled"}
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
                                    setSettings({ ...settings, mcpServers: newServers });
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
                                    setSettings({ ...settings, mcpServers: newServers });
                                }}
                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}

                    {/* Empty State */}
                    {(!settings.mcpServers || settings.mcpServers.length === 0) && (
                        <div className="text-xs text-gray-400 italic text-center py-2">No servers added.</div>
                    )}
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
                                // Try to request permission
                                try {
                                    const urlObj = new URL(urlStr);
                                    const origin = `${urlObj.protocol}//${urlObj.hostname}/*`;
                                    // Handle custom ports
                                    const originWithPort = urlObj.port ? `${urlObj.protocol}//${urlObj.hostname}:${urlObj.port}/*` : origin;

                                    const granted = await chrome.permissions.request({
                                        origins: [originWithPort]
                                    });

                                    if (!granted) {
                                        alert("Permission to access this server was denied. The extension may not be able to connect.");
                                        // We might still add it, or block. 
                                        // Let's block it to ensure user knows it won't work.
                                        return;
                                    }
                                } catch (e) {
                                    console.error("Invalid URL or Permission Error", e);
                                    alert("Invalid URL or unable to request permission.");
                                    return;
                                }

                                const newServers = [...(settings.mcpServers || []), { url: urlStr, enabled: true }];
                                setSettings({ ...settings, mcpServers: newServers });
                                setNewServerUrl('');
                            }}
                            className="px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white rounded-lg text-xs font-medium hover:bg-black disabled:opacity-50"
                        >
                            Add
                        </button>

                    </div>
                </div>
            </div>

            {/* Save Button */}
            <div className="pt-4 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={status === 'saving'}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2 ${status === 'saved' ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
                >
                    <Save size={18} />
                    {status === 'saving' ? 'Saving...' : status === 'saved' ? 'Saved!' : 'Save Changes'}
                </button>
            </div>

            <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
                <button onClick={onBack} className="text-sm text-gray-500 hover:underline">
                    Back to Chat
                </button>
            </div>
        </div>
    );
};
