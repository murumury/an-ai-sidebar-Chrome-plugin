// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mockChatStream = async (messages: any[], onChunk: (chunk: string) => void) => {
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage.content || ''; // Handle potential structure diffs
    const responseText = `[MOCK ECHO] You said: "${content}". \n\nI also received context from the page if you sent it. I am a mock AI response running locally.`;

    const words = responseText.split(' ');

    for (const word of words) {
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate network latency
        onChunk(word + ' ');
    }
};
