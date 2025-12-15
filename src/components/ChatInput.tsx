import { Send, FileText, X, AlertCircle } from 'lucide-react';
import { useRef, useEffect } from 'react';

interface ChatInputProps {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onSubmit: (e: React.FormEvent) => void;
    pageTitle?: string;
    contextEnabled: boolean;
    isContextEnabledSetting: boolean;
    isWarningDismissed?: boolean;
    onDismissWarning?: () => void;
    onToggleContext: () => void;
}

export const ChatInput = ({ value, onChange, onSubmit, pageTitle, contextEnabled, isContextEnabledSetting, isWarningDismissed, onDismissWarning, onToggleContext }: ChatInputProps) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'; // Reset height
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`; // Set to scrollHeight but max 200px
        }
    }, [value]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit(e);
        }
    };

    return (
        <div className="w-full max-w-3xl mx-auto relative group">
            {/* Floating Context Pill (Above Input) */}
            {/* Floating Context Pill (Above Input) */}
            {pageTitle ? (
                <div className="flex justify-center mb-2 pointer-events-none">
                    <button
                        onClick={onToggleContext}
                        className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border transition-all pointer-events-auto shadow-sm ${contextEnabled
                            ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-300'
                            : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                            }`}
                    >
                        <FileText size={12} />
                        <span className="max-w-[150px] truncate">{pageTitle}</span>
                        {contextEnabled ? <div className="bg-blue-200 dark:bg-blue-700 rounded-full p-0.5"><X size={10} /></div> : <span className="opacity-50 text-[10px] uppercase font-bold tracking-wider ml-1">Add</span>}
                    </button>
                </div>
            ) : !isWarningDismissed ? (
                <div className="flex justify-center mb-2 pointer-events-none">
                    <div className="flex items-center bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-700 rounded-full shadow-sm pointer-events-auto transition-all">
                        <button
                            onClick={onToggleContext}
                            className="flex items-center gap-2 px-3 py-1 rounded-l-full text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                            title="Click to enable page context access"
                        >
                            <AlertCircle size={12} />
                            <span>{!isContextEnabledSetting ? "Enable Page Context" : "No Page Content"}</span>
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
                </div>
            ) : null}

            {/* Main Input Box */}
            <div className="relative flex items-end w-full p-3 bg-white dark:bg-[#40414f] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm text-base focus-within:shadow-md focus-within:border-gray-300 dark:focus-within:border-gray-600 transition-all">
                <textarea
                    ref={textareaRef}
                    rows={1}
                    value={value}
                    onChange={onChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Message..."
                    className="w-full max-h-[200px] py-1 pl-1 pr-10 bg-transparent border-none outline-none resize-none text-gray-800 dark:text-gray-100 placeholder-gray-400 align-bottom overflow-y-auto custom-scrollbar"
                />
                <button
                    onClick={onSubmit}
                    disabled={!value.trim()}
                    className="absolute right-2 bottom-2 p-2 rounded-lg bg-black dark:bg-white text-white dark:text-black disabled:bg-transparent disabled:text-gray-300 dark:disabled:text-gray-500 hover:opacity-80 transition-all disabled:hover:opacity-100"
                >
                    <Send size={18} />
                </button>
            </div>
            <div className="text-center text-[10px] text-gray-400 mt-2">
                SideAgent can make mistakes. Check important info.
            </div>
        </div>
    );
};
