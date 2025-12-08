import { MoreHorizontal, SquarePen, X, Settings as SettingsIcon } from 'lucide-react';

interface SidebarHeaderProps {
    onToggleHistory: () => void;
    onToggleSettings: () => void;
    onNewChat: () => void;
    onClose?: () => void;
}

export const SidebarHeader = ({ onToggleHistory, onToggleSettings, onNewChat, onClose }: SidebarHeaderProps) => {
    const iconButtonClass = "p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors";

    return (
        <header className="flex-none flex items-center justify-between px-2 py-2 bg-transparent z-10 transition-colors">
            {/* Left: Menu & Settings */}
            <div className="flex items-center">
                <button className={iconButtonClass} title="History" onClick={onToggleHistory}>
                    <MoreHorizontal size={18} />
                </button>
                <button className={iconButtonClass} title="Settings" onClick={onToggleSettings}>
                    <SettingsIcon size={18} />
                </button>
            </div>

            {/* Middle: Spacer */}
            <div />

            {/* Right: Actions */}
            <div className="flex items-center">
                <button className={iconButtonClass} title="New Chat" onClick={onNewChat}>
                    <SquarePen size={18} />
                </button>
                {/* Close button is often redundant if native side panel has close, but user asked for it. 
                    If native header exists, our close button duplicates the native one. 
                    I'll keep it but make it subtle, or removing it if the user implies native header usage? 
                    User asked to "hide" native header, found impossible, so user knows native exists.
                    Usually having 2 close buttons is weird. I'll make this one clearly "internal" or just keep it. 
                    Let's reduce icon size to 18 for elegance.
                */}
                {onClose && (
                    <button className={iconButtonClass} title="Close Sidebar" onClick={onClose}>
                        <X size={18} />
                    </button>
                )}
            </div>
        </header>
    );
};
