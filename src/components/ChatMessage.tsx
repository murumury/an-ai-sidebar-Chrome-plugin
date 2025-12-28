import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Copy, RotateCw, Pencil, Check, Trash, Image as ImageIcon } from 'lucide-react';
import { clsx as cn } from 'clsx';
import { imageDB } from '../lib/image-db';
import type { AttachedFile } from '../lib/storage';

interface ChatMessageProps {
    id: string; // Added ID for identification
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    onRetry?: (id: string) => void;
    onEdit?: (id: string, newContent: string) => void;
    onDelete?: (id: string) => void;
    isStreaming?: boolean;
    reasoning?: string;
    toolName?: string;
    imageIds?: string[];
    attachedFiles?: AttachedFile[];
    isLast?: boolean;
    showBorder?: boolean;
}


// Custom Pre component to handle code blocks with Copy button
const Pre = ({ children, ...props }: any) => {
    const [copied, setCopied] = useState(false);

    // Extract raw text from children (code element)
    // ReactMarkdown passes the code element as children. 
    // We can try to access props.children of the code element if accessible, 
    // but ref is safer for textContent.
    // Actually, getting the string content for copying:
    // The children of 'pre' is 'code'. The children of 'code' is the text (or spans if highlighted).
    // If highlighted, text extraction is harder from VDOM. 
    // Let's use a ref on the pre element to read textContent.
    const preRef = useRef<HTMLPreElement>(null);

    const handleCopy = () => {
        if (preRef.current) {
            const codeText = preRef.current.textContent || '';
            navigator.clipboard.writeText(codeText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // Try to detect language from code class name
    // children is usually a single element <code>
    const codeChild = children?.props;
    const className = codeChild?.className || '';
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';

    return (
        <div className="relative group/code my-4 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-[#0d1117]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-100/5 dark:bg-white/5 border-b border-black/5 dark:border-white/5 backdrop-blur-sm">
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400 font-bold uppercase">
                    {language || 'Code'}
                </span>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    title="Copy Code"
                >
                    {copied ? (
                        <>
                            <Check size={12} className="text-green-500" />
                            <span className="text-green-500">Copied</span>
                        </>
                    ) : (
                        <>
                            <Copy size={12} />
                            <span>Copy</span>
                        </>
                    )}
                </button>
            </div>
            {/* Code container */}
            <div className="relative">
                {/* 
                   We render the original children (the code element).
                   We attach a ref to capture text content for copy.
                   Note: We rely on standard prose pre styles or our overrides, 
                   but we need to override background since we set it on container.
                 */}
                <pre
                    ref={preRef}
                    {...props}
                    className="!m-0 !rounded-none !bg-transparent !p-4 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
                >
                    {children}
                </pre>
            </div>
        </div>
    );
};

// Custom Code component for inline vs block
const Code = ({ node, inline, className, children, ...props }: any) => {
    // If block, it's handled by Pre usually, but sometimes separate. 
    // ReactMarkdown defaults: block code -> pre > code.
    // If inline, we style it cleanly.
    if (inline) {
        return (
            <code
                className="px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-red-500 dark:text-red-400 font-mono text-sm border border-black/5 dark:border-white/5"
                {...props}
            >
                {children}
            </code>
        );
    }
    // Block code (inside pre)
    return (
        <code className={`${className} bg - transparent`} {...props}>
            {children}
        </code>
    );
};

export const ChatMessage = ({ id, role, content, reasoning, onRetry, onEdit, onDelete, isStreaming, toolName, showBorder = true, imageIds, attachedFiles }: ChatMessageProps) => {
    // ... existings hooks ...
    const isUser = role === 'user';
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(content);
    const [copied, setCopied] = useState(false);

    // Image Logic
    const [imageUrls, setImageUrls] = useState<string[]>([]);
    const [isLoadingImages, setIsLoadingImages] = useState(false);

    useEffect(() => {
        if (imageIds && imageIds.length > 0) {
            setIsLoadingImages(true);
            console.log('[ChatMessage] Loading images for:', imageIds);
            Promise.all(imageIds.map(async (imgId) => {
                try {
                    const img = await imageDB.getImage(imgId);
                    console.log('[ChatMessage] Retrieved image:', imgId, img);

                    if (img && img.image.kind === 'blob' && img.image.value instanceof Blob) {
                        console.log('[ChatMessage] Blob details:', img.image.value.size, img.image.value.type);
                        const url = URL.createObjectURL(img.image.value);
                        console.log('[ChatMessage] Created URL:', url);
                        return url;
                    } else {
                        console.warn('[ChatMessage] Invalid image data:', img);
                        return null;
                    }
                } catch (e) {
                    console.error('[ChatMessage] Error fetching image:', e);
                    return null;
                }
            })).then(urls => {
                const validUrls = urls.filter(u => u !== null) as string[];
                console.log('[ChatMessage] Final valid URLs:', validUrls);
                setImageUrls(validUrls);
                setIsLoadingImages(false);
            });
        }
    }, [imageIds]);

    useEffect(() => {
        return () => {
            imageUrls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [imageUrls]);

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

    // Hide empty assistant messages (e.g. completed tool calls) if they are not streaming
    if (role === 'assistant' && !content && !reasoning && !isStreaming) {
        return null;
    }

    return (
        <div className={cn(
            "group w-full text-gray-800 dark:text-gray-100",
            !isUser && "bg-transparent",
            showBorder && "border-b border-black/5 dark:border-white/5"
        )}>
            <div className={cn(
                "text-base gap-4 md:gap-6 md:max-w-2xl lg:max-w-xl xl:max-w-3xl flex lg:px-0 m-auto w-full p-4",
                isUser ? "justify-end" : "justify-start"
            )}>
                {isUser ? (
                    <div className="flex flex-col items-end max-w-[85%]">
                        <div className="bg-[#95ec69] dark:bg-[#2bcd42] text-black rounded-2xl px-4 py-2 relative overflow-hidden shadow-sm">
                            {/* Attached Files */}
                            {attachedFiles && attachedFiles.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-2 pb-2 border-b border-black/10">
                                    {attachedFiles.map((f, i) => (
                                        <div key={i} className="flex items-center gap-1.5 bg-white/50 dark:bg-black/20 rounded px-2 py-1 text-xs max-w-[200px]" title={`${f.name} (${(f.size / 1024).toFixed(1)}KB)`}>
                                            <span className="truncate">{f.name}</span>
                                            <span className="opacity-50 text-[10px] uppercase">File</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {isEditing ? (
                                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-2 min-w-[200px]">
                                    <textarea
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        className="w-full h-24 bg-transparent outline-none text-sm resize-none dark:text-white"
                                        autoFocus
                                    />
                                    <div className="flex justify-end gap-2 mt-2">
                                        <button onClick={handleCancelEdit} className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:text-white">Cancel</button>
                                        <button onClick={handleSaveEdit} className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">Save</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="whitespace-pre-wrap text-sm break-words break-all">{content}</div>
                            )}
                        </div>
                        {!isEditing && content && !isStreaming && (
                            <div className="flex items-center gap-2 mt-1 mr-1 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 dark:text-gray-500">
                                <button onClick={handleCopy} className="hover:text-gray-600 dark:hover:text-gray-300" title="Copy">
                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                                {onEdit && (
                                    <button onClick={() => setIsEditing(true)} className="hover:text-gray-600 dark:hover:text-gray-300" title="Edit">
                                        <Pencil size={14} />
                                    </button>
                                )}
                                {onDelete && (
                                    <button onClick={() => onDelete(id)} className="hover:text-red-500 dark:hover:text-red-400" title="Delete">
                                        <Trash size={14} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="relative overflow-hidden flex-1">
                        {/* Header */}
                        {(role === 'tool' || toolName) && (
                            <div className="flex items-center gap-2 select-none mb-1">
                                <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                                    {role === 'tool' ? 'MCP Tool Output' : ''}
                                </span>
                                {toolName && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-mono">
                                        {toolName}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Tool Execution Loading State */}
                        {role === 'tool' && !content && (
                            <div className="flex items-center gap-2 text-gray-500 text-sm italic animate-pulse py-1">
                                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full"></div>
                                <span>Using tool...</span>
                            </div>
                        )}

                        {/* Image Rendering */}
                        {imageUrls.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                                {imageUrls.map((url, idx) => (
                                    <div key={idx} className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm max-w-[300px]">
                                        <img src={url} alt="Generated" className="w-full h-auto object-cover" />
                                    </div>
                                ))}
                            </div>
                        )}
                        {isLoadingImages && (
                            <div className="flex items-center gap-2 text-xs text-gray-400 animate-pulse mb-2">
                                <ImageIcon size={14} />
                                Loading images...
                            </div>
                        )}

                        {role === 'tool' ? (
                            <details className="group/tool mb-2" open={!content}>
                                <summary className="cursor-pointer text-xs font-medium text-gray-500 flex items-center gap-1 select-none hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                                    <div className="p-0.5 bg-gray-200 dark:bg-gray-600 rounded text-gray-500 dark:text-gray-300">
                                        {content ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
                                        ) : (
                                            <div className="w-2.5 h-2.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                        )}
                                    </div>
                                    <span>{content ? 'MCP Tool Output' : `Using ${toolName || 'Tool'}...`}</span>
                                </summary>
                                {content && (
                                    <div className="mt-2 pl-3 border-l-2 border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-mono bg-black/5 dark:bg-white/5 p-3 rounded-r-lg overflow-x-auto">
                                        {content}
                                        <div className="flex justify-end mt-2">
                                            <button onClick={handleCopy} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 uppercase tracking-wider font-bold">
                                                {copied ? <Check size={10} /> : <Copy size={10} />}
                                                <span>{copied ? 'Copied' : 'Copy'}</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </details>
                        ) : (
                            <>
                                {reasoning && (
                                    <details className="mb-2 group/reasoning">
                                        <summary className="cursor-pointer text-xs font-medium text-gray-500 flex items-center gap-1 select-none hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                                            <div className="w-1 h-3 bg-gray-300 dark:bg-gray-600 rounded-full mr-1"></div>
                                            <span>Thinking Process</span>
                                        </summary>
                                        <div className="mt-2 pl-3 border-l-2 border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-mono bg-black/5 dark:bg-white/5 p-3 rounded-r-lg">
                                            {reasoning}
                                        </div>
                                    </details>
                                )}
                                <div className="markdown-body prose prose-sm dark:prose-invert max-w-none break-words overflow-x-auto">
                                    {content ? (
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            rehypePlugins={[rehypeHighlight]}
                                            components={{ pre: Pre, code: Code }}
                                        >
                                            {content}
                                        </ReactMarkdown>
                                    ) : (isStreaming && !reasoning) ? (
                                        <div className="flex items-center gap-1 h-6">
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                        </div>
                                    ) : null}
                                </div>
                            </>
                        )}

                        {/* Action Buttons for Assistant */}
                        {role === 'assistant' && (content || imageUrls.length > 0) && !isStreaming && id !== 'welcome' && (
                            <div className="flex items-center gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400">
                                <button onClick={handleCopy} className="flex items-center gap-1 hover:text-gray-600 dark:hover:text-gray-300 text-xs" title="Copy Message">
                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                    <span>Copy</span>
                                </button>
                                {onRetry && (
                                    <button onClick={() => onRetry(id)} className="flex items-center gap-1 hover:text-gray-600 dark:hover:text-gray-300 text-xs" title="Retry">
                                        <RotateCw size={14} />
                                        <span>Retry</span>
                                    </button>
                                )}
                                {onDelete && (
                                    <button onClick={() => onDelete(id)} className="flex items-center gap-1 hover:text-red-500 dark:hover:text-red-400 text-xs" title="Delete">
                                        <Trash size={14} />
                                        <span>Delete</span>
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
