import type { ChatSession } from '../lib/storage';
import { MessageSquare, Trash2, Calendar } from 'lucide-react';

interface HistoryViewProps {
    sessions: ChatSession[];
    onSelectSession: (id: string) => void;
    onDeleteSession: (id: string, e: React.MouseEvent) => void;
    onClearAll: () => void;
    currentSessionId?: string;
}

export const HistoryView = ({ sessions, onSelectSession, onDeleteSession, onClearAll, currentSessionId }: HistoryViewProps) => {
    // Sort by date desc
    const sortedSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center sticky top-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-10">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                    <Calendar size={18} className="text-blue-500" />
                    History
                </h2>
                {sessions.length > 0 && (
                    <button
                        onClick={() => {
                            if (confirm("Are you sure you want to delete all history?")) onClearAll();
                        }}
                        className="text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                        title="Clear All History"
                    >
                        <Trash2 size={14} />
                        Clear All
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {sortedSessions.length === 0 ? (
                    <div className="text-center text-gray-400 mt-10 text-sm">No history yet.</div>
                ) : (
                    sortedSessions.map((session) => (
                        <div
                            key={session.id}
                            onClick={() => onSelectSession(session.id)}
                            className={`group relative p-3 rounded-lg border text-left transition-all cursor-pointer hover:shadow-sm ${currentSessionId === session.id
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-700'
                                }`}
                        >
                            <div className="flex justify-between items-start gap-2">
                                <div className="flex items-start gap-2 overflow-hidden">
                                    <MessageSquare size={16} className={`mt-0.5 flex-shrink-0 ${currentSessionId === session.id ? 'text-blue-500' : 'text-gray-400'}`} />
                                    <div className="min-w-0">
                                        <h3 className="font-medium text-sm truncate text-gray-800 dark:text-gray-200 pr-4">
                                            {session.title || 'Untitled Chat'}
                                        </h3>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {new Date(session.updatedAt).toLocaleString()}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={(e) => onDeleteSession(session.id, e)}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-all absolute right-2 top-2"
                                    title="Delete Chat"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
