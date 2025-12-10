import OpenAI from 'openai';
import type { Settings } from './storage';

export interface LLMMessage {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string | null;
    reasoning_content?: string; // DeepSeek/Reasoning models
    tool_calls?: any[];
    tool_call_id?: string;
    name?: string; // For tool role
}

export type StreamEvent =
    | { type: 'content'; content: string }
    | { type: 'reasoning'; content: string } // New event type
    | { type: 'tool_call_start'; toolCallId: string; name: string }
    | { type: 'tool_call_delta'; args: string }
    | { type: 'tool_call_end' };

export const runLLMStream = async function* (
    messages: LLMMessage[],
    settings: Settings,
    tools?: any[]
): AsyncGenerator<StreamEvent, void, unknown> {
    // Relaxed Validation: Allow empty API Key if using custom provider (likely local)
    let finalApiKey = settings.apiKey;
    if (!finalApiKey) {
        if (settings.provider === 'custom' || settings.baseUrl) {
            finalApiKey = 'not-needed';
        } else {
            throw new Error('API Key is missing. Please check your settings.');
        }
    }

    const baseUrl = settings.baseUrl || (
        settings.provider === 'vivgrid' ? 'https://api.vivgrid.com/v1' :
            undefined
    );

    const client = new OpenAI({
        apiKey: finalApiKey,
        baseURL: baseUrl,
        dangerouslyAllowBrowser: true
    });

    let modelId = settings.model;
    if (!modelId && settings.provider === 'vivgrid') modelId = 'default';
    if (!modelId) modelId = 'gpt-4o';

    const params: any = {
        model: modelId,
        messages: messages, // Ensure reasoning_content is passed if present in history
        stream: true,
    };

    if (tools && tools.length > 0) {
        params.tools = tools;
    }

    const stream = await client.chat.completions.create(params) as any;



    for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        // 0. Reasoning Content (DeepSeek)
        if (delta.reasoning_content) {
            yield { type: 'reasoning', content: delta.reasoning_content };
        }

        // 1. Text Content
        if (delta.content) {
            yield { type: 'content', content: delta.content };
        }

        // 2. Tool Calls
        if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
                // Determine if this is a new tool call or continuation
                // OpenAI sends index for parallel tool calls

                // If it has both id and function.name, it's usually a start
                if (tc.id && tc.function?.name) {
                    yield {
                        type: 'tool_call_start',
                        toolCallId: tc.id,
                        name: tc.function.name
                    };
                }

                // Arguments delta
                if (tc.function?.arguments) {
                    yield { type: 'tool_call_delta', args: tc.function.arguments };
                }
            }
        }
    }

    // Explicit end of tool calls isn't strictly sent by OAI stream as an event,
    // but the loop finishing implies it. `App.tsx` handles aggregation logic implicitly or via 'tool_call_end' if we emitted it.
    // For now, simple yielding is enough. App logic detects tool call completion by stream end or next start.
    // Actually, App logic (Step 812) does `toolCalls.push(currentToolCall)` on `tool_call_end`.
    // So we should yield `tool_call_end`? Accessing `tool_call_end` inside a loop is hard because stream doesn't explicitly frame it.
    // BETTER STRATEGY:
    // App.tsx logic accumulates args until stream ends?
    // Yes, the `tool_call_end` event in `App.tsx` is actually hard to trigger from OAI stream unless we buffer.
    // Let's modify App.tsx to finalize tool calls AFTER the loop.
};
