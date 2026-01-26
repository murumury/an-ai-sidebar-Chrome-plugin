import { Send, FileText, X, AlertCircle, ChevronDown, ChevronRight, Check, Image as ImageIcon, Paperclip, Square } from 'lucide-react';
import { useRef, useEffect, useState } from 'react';
import { BUILTIN_MODELS } from '../lib/storage';
import type { Settings, CustomProvider } from '../lib/storage';
import { ProviderLogo } from './ProviderLogo';

interface ChatInputProps {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onSubmit: (e: React.FormEvent, files?: File[]) => void; // Updated signature
    pageTitle?: string;
    contextEnabled: boolean;
    isContextEnabledSetting: boolean;
    isWarningDismissed?: boolean;
    onDismissWarning?: () => void;
    onToggleContext: () => void;
    settings?: Settings | null;
    onUpdateSettings: (newSettings: Settings) => void;
    isStreaming?: boolean; // Whether the model is currently generating
    onStop?: () => void; // Callback to stop generation
}

export const ChatInput = ({ value, onChange, onSubmit, pageTitle, contextEnabled, isContextEnabledSetting, isWarningDismissed, onDismissWarning, onToggleContext, settings, onUpdateSettings, isStreaming, onStop }: ChatInputProps) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showModelMenu, setShowModelMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const [expandedProvider, setExpandedProvider] = useState<string | null>(null);

    // Local state for file preview before sending
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'; // Reset height
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`; // Set to scrollHeight but max 200px
        }
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowModelMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Prevent submission if the user is using an IME (Input Method Editor)
        if (e.nativeEvent.isComposing) {
            return;
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            const validFiles = newFiles.filter(file => {
                if (file.size > 20 * 1024 * 1024) {
                    alert(`File ${file.name} exceeds the 20MB limit.`);
                    return false;
                }
                return true;
            });
            if (validFiles.length > 0) {
                setSelectedFiles(prev => [...prev, ...validFiles]);
            }
        }
        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // We need to intercept submit to pass files
    const handleSubmit = (e: React.FormEvent) => {
        onSubmit(e, selectedFiles);
        setSelectedFiles([]); // Clear local after submit
    };

    const handleModelSelect = (providerId: string, model: string) => {
        if (!settings) return;

        const providerConfig = settings.providerSettings[providerId];

        // When selecting a model, we also switch the active provider
        // AND we must sync the top-level apiKey/baseUrl to the new provider's stored values
        const newSettings = {
            ...settings,
            provider: providerId,
            model: model,
            apiKey: providerConfig?.apiKey || '',
            baseUrl: providerConfig?.baseUrl || ''
        };

        // Also update nested settings for persistence
        if (newSettings.providerSettings[providerId]) {
            newSettings.providerSettings = {
                ...newSettings.providerSettings,
                [providerId]: {
                    ...newSettings.providerSettings[providerId],
                    model: model
                }
            };
        }

        onUpdateSettings(newSettings);
        setShowModelMenu(false);
    };

    const getProviderDisplayName = (id: string, customProviders: CustomProvider[] = []) => {
        const custom = customProviders.find(p => p.id === id);
        if (custom) return custom.name;
        const map: Record<string, string> = {
            openai: 'OpenAI',
            anthropic: 'Anthropic',
            google: 'Google',
            grok: 'Grok',
            deepseek: 'DeepSeek',
            vivgrid: 'Vivgrid',
            custom: 'Custom'
        };
        return map[id] || id;
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    if (!settings) return null; // Or skeleton

    const currentProviderName = getProviderDisplayName(settings.provider, settings.customProviders);
    const currentModelName = settings.model || 'Default';
    const isStandardProvider = ['openai', 'anthropic', 'google', 'grok', 'deepseek', 'vivgrid'].includes(settings.provider);

    // Combine standard providers and custom providers keys
    const standardProviderKeys = ['openai', 'anthropic', 'google', 'grok', 'deepseek', 'vivgrid'];
    const customProviderKeys = settings.customProviders?.map(p => p.id) || [];
    const allProviderKeys = [...standardProviderKeys, ...customProviderKeys];

    return (
        <div className="w-full max-w-3xl mx-auto relative group">

            {/* Context & Model Selector Row */}
            <div className="flex justify-center mb-2 gap-2 relative z-20">
                {/* 1. Context Pill */}
                {pageTitle ? (
                    <button
                        onClick={onToggleContext}
                        className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border transition-all shadow-sm ${contextEnabled
                            ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-300'
                            : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                            }`}
                    >
                        <FileText size={12} />
                        <span className="max-w-[100px] truncate">{pageTitle}</span>
                        {contextEnabled ? <div className="bg-blue-200 dark:bg-blue-700 rounded-full p-0.5"><X size={10} /></div> : <span className="opacity-50 text-[10px] uppercase font-bold tracking-wider ml-1">Add</span>}
                    </button>
                ) : !isWarningDismissed ? (
                    <div className="flex items-center bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-700 rounded-full shadow-sm transition-all">
                        <button
                            onClick={onToggleContext}
                            className="flex items-center gap-2 px-3 py-1 rounded-l-full text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 max-w-[200px]"
                            title={!isContextEnabledSetting ? "Click to enable page context access" : "No page context access"}
                        >
                            <AlertCircle size={12} className="shrink-0" />
                            <span className="truncate">{!isContextEnabledSetting ? "Get Page" : "No Page"}</span>
                        </button>
                        <div className="w-[1px] h-4 bg-amber-200 dark:bg-amber-700"></div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDismissWarning?.();
                            }}
                            className="px-2 py-1 rounded-r-full text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                        >
                            <X size={12} />
                        </button>
                    </div>
                ) : null}

                {/* 2. Model Selector Pill */}
                <div ref={menuRef} className="relative">
                    <button
                        onClick={() => setShowModelMenu(!showModelMenu)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 shadow-sm transition-all max-w-[240px]"
                    >
                        {isStandardProvider ? (
                            <ProviderLogo id={settings.provider} className="text-gray-600 dark:text-gray-300 mr-0.5" />
                        ) : (
                            <span className="opacity-70 truncate max-w-[80px]">{currentProviderName}</span>
                        )}
                        <span className="w-[1px] h-3 bg-gray-200 dark:bg-gray-600 mx-0.5 shrink-0"></span>
                        <span className="truncate max-w-[7ch]">{currentModelName}</span>
                        <ChevronDown size={12} className={`opacity-50 transition-transform shrink-0 ${showModelMenu ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {showModelMenu && (
                        <div className="absolute bottom-full left-0 mb-2 w-64 max-h-[400px] overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl z-50 flex flex-col text-sm custom-scrollbar">
                            <div className="p-2 sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 z-10">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-2">Select Model</span>
                            </div>

                            <div className="p-1 space-y-1">
                                {allProviderKeys.map(pKey => {
                                    const pName = getProviderDisplayName(pKey, settings.customProviders);

                                    const config = settings.providerSettings[pKey] || { customModels: [] };
                                    const customModels = config.customModels || [];
                                    const allModels = pKey.startsWith('custom_') ? customModels : [...(BUILTIN_MODELS[pKey] || []), ...customModels];

                                    if (allModels.length === 0 && !pKey.startsWith('custom_')) return null;

                                    const isExpanded = expandedProvider === pKey || settings.provider === pKey;
                                    const isActiveProvider = settings.provider === pKey;

                                    return (
                                        <div key={pKey} className="rounded overflow-hidden">
                                            <button
                                                onClick={() => setExpandedProvider(isExpanded ? null : pKey)}
                                                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${isActiveProvider ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10' : 'text-gray-700 dark:text-gray-300'}`}
                                            >
                                                <span>{pName}</span>
                                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            </button>

                                            {isExpanded && (
                                                <div className="bg-gray-50 dark:bg-gray-900/30 px-1 py-1 space-y-0.5">
                                                    {allModels.length > 0 ? allModels.map(m => {
                                                        const isImageModel = m.includes('dall-e') || m.includes('image');
                                                        return (
                                                            <button
                                                                key={m}
                                                                onClick={() => handleModelSelect(pKey, m)}
                                                                className={`w-full text-left px-4 py-1.5 text-xs rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-between ${isActiveProvider && settings.model === m ? 'text-blue-600 font-medium bg-blue-50 dark:bg-blue-900/20' : 'text-gray-600 dark:text-gray-400'}`}
                                                            >
                                                                <span className="truncate flex items-center">
                                                                    {isImageModel && <ImageIcon size={12} className="mr-1.5 text-purple-500 shrink-0" />}
                                                                    {m}
                                                                </span>
                                                                {isActiveProvider && settings.model === m && <Check size={12} />}
                                                            </button>
                                                        );
                                                    }) : (
                                                        <div className="px-4 py-2 text-[10px] text-gray-400 italic">No models found. Add in Settings.</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* File Preview Chips */}
            {selectedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 px-3 mb-2">
                    {selectedFiles.map((f, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1 text-xs text-gray-700 dark:text-gray-200">
                            <span className="truncate max-w-[150px]">{f.name}</span>
                            <span className="opacity-50 text-[10px]">{(f.size / 1024).toFixed(1)}KB</span>
                            <button onClick={() => removeFile(idx)} className="hover:text-red-500">
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Main Input Box */}
            <div className="relative flex items-end w-full p-3 bg-white dark:bg-[#40414f] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm text-base focus-within:shadow-md focus-within:border-gray-300 dark:focus-within:border-gray-600 transition-all z-10">
                <input
                    type="file"
                    multiple
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                />

                {/* Upload Button */}
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 mr-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Upload file for context"
                >
                    <Paperclip size={18} />
                </button>

                <textarea
                    ref={textareaRef}
                    rows={1}
                    value={value}
                    onChange={onChange}
                    onKeyDown={handleKeyDown}
                    placeholder={`Ask anything...`}
                    className="w-full max-h-[200px] py-1 bg-transparent border-none outline-none resize-none text-gray-800 dark:text-gray-100 placeholder-gray-400 align-bottom overflow-y-auto custom-scrollbar"
                />
                {isStreaming ? (
                    <button
                        onClick={onStop}
                        className="p-2 ml-1 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all"
                        title="Stop generating"
                    >
                        <Square size={18} fill="currentColor" />
                    </button>
                ) : (
                    <button
                        onClick={handleSubmit}
                        disabled={!value.trim() && selectedFiles.length === 0}
                        className="p-2 ml-1 rounded-lg bg-black dark:bg-white text-white dark:text-black disabled:bg-transparent disabled:text-gray-300 dark:disabled:text-gray-500 hover:opacity-80 transition-all disabled:hover:opacity-100"
                    >
                        <Send size={18} />
                    </button>
                )}
            </div>
            <div className="text-center text-[10px] text-gray-400 mt-2">
                AI can make mistakes. Check important info.
            </div>
        </div>
    );
};
