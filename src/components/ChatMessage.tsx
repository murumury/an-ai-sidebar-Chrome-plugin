import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Copy, RotateCw, Pencil, Check } from 'lucide-react';
import { clsx as cn } from 'clsx';

interface ChatMessageProps {
    id: string; // Added ID for identification
    role: 'user' | 'assistant' | 'system';
    content: string;
    onRetry?: (id: string) => void;
    onEdit?: (id: string, newContent: string) => void;
}

export const ChatMessage = ({ id, role, content, onRetry, onEdit }: ChatMessageProps) => {
    const isUser = role === 'user';
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(content);
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSaveEdit = () => {
        if (onEdit && editContent.trim() !== content) {
            onEdit(id, editContent);
        }
        setIsEditing(false);
    };

    const handleCancelEdit = () => {
        setEditContent(content);
        setIsEditing(false);
    };

    return (
        <div className={cn(
            "group w-full text-gray-800 dark:text-gray-100",
            // For AI (assistant), keep the full-width background. For User, transparent background.
            !isUser && "border-b border-black/5 dark:border-white/5 bg-gray-50 dark:bg-[#444654]"
        )}>
            <div className={cn(
                "text-base gap-4 md:gap-6 md:max-w-2xl lg:max-w-xl xl:max-w-3xl flex lg:px-0 m-auto w-full p-4",
                // User messages right-aligned
                isUser ? "justify-end" : "justify-start"
            )}>
                {/* Content & Actions */}
                {/* Content & Actions */}
                {isUser ? (
                    <div className="flex flex-col items-end max-w-[85%]">
                        <div className="bg-[#95ec69] dark:bg-[#2bcd42] text-black rounded-2xl px-4 py-2 relative overflow-hidden">
                            {/* Message Body */}
                            {isEditing ? (
                                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-2 min-w-[200px]">
                                    <textarea
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        className="w-full h-24 bg-transparent outline-none text-sm resize-none"
                                        autoFocus
                                    />
                                    <div className="flex justify-end gap-2 mt-2">
                                        <button onClick={handleCancelEdit} className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300">Cancel</button>
                                        <button onClick={handleSaveEdit} className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">Save</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="markdown-body text-left">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        rehypePlugins={[rehypeHighlight]}
                                        components={{
                                            // Override pre/code styles if needed for the green bubble, 
                                            // but default markdown-body styles should be acceptable (dark blocks).
                                            // Ensure text wraps in paragraphs
                                            p: ({ node, ...props }) => <p className="mb-1 last:mb-0 break-all" {...props} />,
                                            // Custom Pre for conditional styling
                                            pre: ({ node, ...props }) => (
                                                <pre
                                                    className={cn(
                                                        "rounded-lg my-2 overflow-x-auto p-4",
                                                        // User bubble: Dark semi-transparent background to contrast with green, but not pitch black
                                                        // AI bubble: Default dark
                                                        isUser ? "bg-black/10 dark:bg-black/20 text-sm" : "bg-[#0d1117]"
                                                    )}
                                                    {...props}
                                                />
                                            ),
                                            // Custom Code to ensure text color visibility
                                            code: ({ node, className, children, ...props }) => {
                                                const match = /language-(\w+)/.exec(className || '');
                                                return match ? (
                                                    <code className={className} {...props}>
                                                        {children}
                                                    </code>
                                                ) : (
                                                    <code className={cn(className, isUser ? "bg-black/10 dark:bg-white/10 rounded px-1" : "bg-black/10 dark:bg-white/10 rounded px-1")} {...props}>
                                                        {children}
                                                    </code>
                                                )
                                            }
                                        }}
                                    >
                                        {content}
                                    </ReactMarkdown>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons (Outside for User) */}
                        {!isEditing && content && (
                            <div className="flex items-center gap-2 mt-1 mr-1 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 dark:text-gray-500">
                                <button onClick={handleCopy} className="hover:text-gray-600 dark:hover:text-gray-300" title="Copy">
                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                                {onEdit && (
                                    <button onClick={() => setIsEditing(true)} className="hover:text-gray-600 dark:hover:text-gray-300" title="Edit">
                                        <Pencil size={14} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="relative overflow-hidden flex-1">
                        {/* Message Body */}
                        <div className="markdown-body">
                            {content ? (
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    rehypePlugins={[rehypeHighlight]}
                                >
                                    {content}
                                </ReactMarkdown>
                            ) : (
                                /* Loading Indicator */
                                <div className="flex items-center gap-1 h-6">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons (Inside for AI) */}
                        {content && (
                            <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400">
                                <button onClick={handleCopy} className="hover:text-gray-600 dark:hover:text-gray-300" title="Copy">
                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                                {onRetry && (
                                    <button onClick={() => onRetry(id)} className="hover:text-gray-600 dark:hover:text-gray-300" title="Retry">
                                        <RotateCw size={14} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
