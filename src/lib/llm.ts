import OpenAI from 'openai';
import type { Settings } from './storage';

export interface LLMMessage {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string | null;
    tool_calls?: any[];
    tool_call_id?: string;
    name?: string; // For tool role
}

export const runLLMStream = async (
    messages: LLMMessage[],
    settings: Settings,
    onChunk: (chunk: string) => void,
    tools?: any[]
): Promise<LLMMessage> => {
    if (!settings.apiKey) {
        throw new Error('API Key is missing. Please check your settings.');
    }

    const baseUrl = settings.baseUrl || (
        settings.provider === 'vivgrid' ? 'https://api.vivgrid.com/v1' :
            undefined
    );

    const client = new OpenAI({
        apiKey: settings.apiKey,
        baseURL: baseUrl,
        dangerouslyAllowBrowser: true
    });

    let modelId = settings.model;
    if (!modelId && settings.provider === 'vivgrid') modelId = 'default';
    if (!modelId) modelId = 'gpt-4o';

    const params: any = {
        model: modelId,
        messages: messages,
        stream: true,
    };

    if (tools && tools.length > 0) {
        params.tools = tools;
    }

    const stream = await client.chat.completions.create(params) as any;

    let finalContent = '';
    const toolCallsMap: Record<number, any> = {};

    for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (delta?.content) {
            finalContent += delta.content;
            onChunk(delta.content);
        }

        if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
                const idx = tc.index;
                if (!toolCallsMap[idx]) {
                    toolCallsMap[idx] = {
                        index: idx,
                        id: tc.id,
                        type: 'function',
                        function: { name: '', arguments: '' }
                    };
                }
                if (tc.id) toolCallsMap[idx].id = tc.id;
                if (tc.function?.name) toolCallsMap[idx].function.name += tc.function.name;
                if (tc.function?.arguments) toolCallsMap[idx].function.arguments += tc.function.arguments;
            }
        }
    }

    const tool_calls = Object.values(toolCallsMap);

    return {
        role: 'assistant',
        content: finalContent || null,
        ...(tool_calls.length > 0 ? { tool_calls } : {})
    };
};
