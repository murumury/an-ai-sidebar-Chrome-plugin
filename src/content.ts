// Basic content script to extract page content

// Listen for messages from the side panel
// eslint-disable-next-line @typescript-eslint/no-explicit-any
chrome.runtime.onMessage.addListener((request: any, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
    if (request.action === 'GET_PAGE_CONTENT') {
        // Extract title
        const title = document.title || 'Untitled Page';

        // Extract text content (simplistic approach for now)
        // In a real app, you might want better parsing (Readability.js etc.)
        const content = document.body.innerText || '';

        // Limit content size to avoid context window issues during dev
        const trimmedContent = content.substring(0, 10000);

        sendResponse({
            title,
            content: trimmedContent,
            url: window.location.href
        });
    }
    return true; // Keep channel open for async response
});

console.log('AgentDock Content Script Loaded');
