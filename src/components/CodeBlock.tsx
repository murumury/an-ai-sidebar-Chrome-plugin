import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { clsx as cn } from 'clsx';

interface CodeBlockProps {
    language: string;
    children: React.ReactNode;
    isUser?: boolean; // Optional, currently unused but kept for compatibility
}

export const CodeBlock = ({ language, children }: CodeBlockProps) => {
    const [copied, setCopied] = useState(false);

    // Generate unique ID for this block to grab text
    const uniqueId = Math.random().toString(36).substr(2, 9);

    const handleCopy = async () => {
        const codeElement = document.getElementById(`code-${uniqueId}`);
        if (codeElement) {
            await navigator.clipboard.writeText(codeElement.innerText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // Determine display language name
    const displayLang = language ? language.replace('language-', '') : 'text';

    return (
        <div className={cn(
            "rounded-lg overflow-hidden my-4 border",
            "border-gray-200 dark:border-gray-700",
            "bg-white dark:bg-[#0d1117]"
        )}>
            {/* Header */}
            <div className={cn(
                "flex items-center justify-between px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700"
            )}>
                <span className="font-mono font-medium lowercase">{displayLang}</span>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                >
                    {copied ? (
                        <>
                            <Check size={12} />
                            <span>Copied</span>
                        </>
                    ) : (
                        <>
                            <Copy size={12} />
                            <span>Copy code</span>
                        </>
                    )}
                </button>
            </div>

            {/* Content */}
            <div className="overflow-x-auto p-4 text-sm font-mono leading-relaxed bg-[#f6f8fa] dark:bg-[#0d1117]">
                {/* 
                   We attach the children here. 
                   If rehype-highlight is generic, it might need specific styles.
                   We assume standard hljs classes are global.
                 */}
                <div id={`code-${uniqueId}`} className={cn(language)}>
                    {children}
                </div>
            </div>
        </div>
    );
};
