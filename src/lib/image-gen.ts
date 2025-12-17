import OpenAI from 'openai';
import type { Settings } from './storage';
import type { UnifiedImage } from './types';
import { DEFAULT_PROVIDER_SETTINGS } from './storage';

export async function generateImage(
    prompt: string,
    settings: Settings
): Promise<UnifiedImage> {
    const { provider, apiKey, baseUrl, model } = settings;

    // Resolve API Key
    let finalApiKey = apiKey || DEFAULT_PROVIDER_SETTINGS[provider]?.apiKey;
    // Fallback if global key empty but provider specific (not implemented in settings interface clearly yet, mostly shared)
    // Assuming settings.apiKey is the correct one for the active provider as managed by ChatInput/Settings switch.

    if (!finalApiKey && provider !== 'custom') {
        throw new Error('API Key is missing');
    }

    // Resolve Base URL
    let finalBaseUrl = baseUrl;
    if (!finalBaseUrl) {
        finalBaseUrl = DEFAULT_PROVIDER_SETTINGS[provider]?.baseUrl;
    }

    let imageBlob: Blob;
    let mimeType = 'image/png';

    // Google (Gemini/Imagen) Specific Handling
    if (provider === 'google') {
        if (!model) throw new Error('Model is required for image generation');

        // Construct Imagen URL
        // Construct Gemini URL for generateContent (Unified API)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${finalApiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    responseModalities: ["IMAGE", "TEXT"],
                    // Optional: imageConfig: { imageSize: '1024x1024' } if needed, but defaults usually work
                }
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Google Image Gen Failed: ${response.status} - ${err}`);
        }

        const data = await response.json();

        // Response format: candidates[0].content.parts[0].inlineData.data (Base64)
        const inlineData = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData;

        if (!inlineData || !inlineData.data) {
            // Check if there's text rejection or other info
            const textPart = data.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text;
            if (textPart) {
                throw new Error(`Google API returned text instead of image: ${textPart}`);
            }
            throw new Error('No image returned from Google API');
        }

        const base64 = inlineData.data;
        // Convert Base64 to Blob
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);

        // MimeType usually in inlineData.mimeType, default to image/png
        const responseMime = inlineData.mimeType || 'image/png';
        imageBlob = new Blob([byteArray], { type: responseMime });
        mimeType = responseMime;

    } else {
        // OpenAI / Grok / Generic OpenAI Compatible

        // If specific Grok handling needed:
        // xAI API uses standard OpenAI format: https://docs.x.ai/docs#image-generation
        // So OpenAI SDK should work.

        const client = new OpenAI({
            apiKey: finalApiKey || 'not-needed',
            baseURL: finalBaseUrl,
            dangerouslyAllowBrowser: true
        });

        const params: any = {
            model: model || 'dall-e-3',
            prompt: prompt,
        };

        // Grok (xAI) currently rejects 'size' parameter. 
        // Only include standard OpenAI params if NOT Grok.
        if (settings.provider !== 'grok' && !model.includes('grok')) {
            params.n = 1;
            params.size = "1024x1024";
        }

        const response = await client.images.generate(params);

        if (!response.data || response.data.length === 0) {
            throw new Error('No image data returned from API');
        }
        const data = response.data[0];

        if (data.b64_json) {
            // If provider returns b64_json despite not asking (or we eventually ask), use it
            const base64 = data.b64_json;
            const byteCharacters = atob(base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            imageBlob = new Blob([byteArray], { type: 'image/png' });
        } else if (data.url) {
            // Default: Fetch the image from the returned URL
            // Note: This requires the URL to be accessible (CORS might be an issue for some, but typically image APIs are open)
            const imgResponse = await fetch(data.url);
            if (!imgResponse.ok) {
                throw new Error(`Failed to download generated image from URL: ${imgResponse.statusText}`);
            }
            imageBlob = await imgResponse.blob();
        } else {
            throw new Error('No image data returned (url and b64_json missing)');
        }
    }

    // Create UnifiedImage
    const unifiedImage: UnifiedImage = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        prompt: prompt,
        model: model || 'unknown',
        image: {
            mime: mimeType,
            kind: 'blob',
            value: imageBlob
        }
    };

    return unifiedImage;
}
