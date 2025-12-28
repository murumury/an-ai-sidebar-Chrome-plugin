/**
 * File Processing Service
 * Handles reading files and splitting them into chunks for LLM context.
 */

export interface FileChunk {
    fileName: string;
    chunkIndex: number;
    totalChunks: number;
    content: string;
}

export class FileProcessor {
    /**
     * Reads a list of files and returns their text content.
     * Only supports text-based files for now.
     */
    static async readFiles(files: File[]): Promise<{ name: string, content: string }[]> {
        const results = [];
        for (const file of files) {
            try {
                const content = await this.readFileAsText(file);
                results.push({ name: file.name, content });
            } catch (e) {
                console.error(`Failed to read file ${file.name}:`, e);
                // Skip failed files or handle error? For now, skip.
            }
        }
        return results;
    }

    private static readFileAsText(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    /**
     * Splits text into manageable chunks with overlap.
     * Simple character-based splitter.
     */
    static splitText(text: string, chunkSize: number = 2000, overlap: number = 200): string[] {
        if (text.length <= chunkSize) {
            return [text];
        }

        const chunks: string[] = [];
        let startIndex = 0;

        while (startIndex < text.length) {
            let endIndex = startIndex + chunkSize;

            // If not the last chunk, try to find a natural break point (newline) within the overlap zone
            if (endIndex < text.length) {
                // const lookAhead = text.substring(endIndex, endIndex + 100); // Check slightly ahead
                const lastNewLine = text.lastIndexOf('\n', endIndex);

                // If there's a newline reasonably close to the limit (within last 15% of chunk), use it
                // Or if we can strictly respect the hard limit
                if (lastNewLine > startIndex + (chunkSize * 0.8)) {
                    endIndex = lastNewLine;
                }
            }

            const chunk = text.substring(startIndex, endIndex);
            chunks.push(chunk);

            // Move forward, subtracting overlap
            // If we are at the end, break
            if (endIndex >= text.length) break;

            startIndex = endIndex - overlap;
            // Prevent infinite loop if overlap is too big (shouldn't happen with these defaults)
            if (startIndex >= endIndex) {
                startIndex = endIndex;
            }
        }

        return chunks;
    }

    /**
     * Process files: Read -> Split -> format for Prompt
     */
    static async processFilesForPrompt(files: File[]): Promise<string> {
        const rawFiles = await this.readFiles(files);
        let promptInjection = "\n\n--- USE ATTACHED FILES AS CONTEXT ---\n";

        for (const f of rawFiles) {
            const chunks = this.splitText(f.content);
            promptInjection += `\nFile: ${f.name} (Total Chunks: ${chunks.length})\n`;

            chunks.forEach((chunk, idx) => {
                promptInjection += `--- Chunk ${idx + 1}/${chunks.length} ---\n${chunk}\n`;
            });

            promptInjection += `--- End of File: ${f.name} ---\n`;
        }

        return promptInjection;
    }
}
