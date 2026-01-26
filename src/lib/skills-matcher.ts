import OpenAI from 'openai';
import type { SkillMetadata } from './skills-storage';
import { getSettings, DEFAULT_PROVIDER_SETTINGS } from './storage';

/**
 * SkillsMatcher - Matches user messages to relevant skills
 * 
 * Matching strategies:
 * 1. Explicit command: /use-skill skill-name
 * 2. LLM matching: Ask a lightweight model to select relevant skills
 * 3. Keyword fallback: Simple text matching (TODO)
 */
export class SkillsMatcher {
    private static readonly MAX_SKILLS = 3; // Limit to prevent token explosion

    /**
     * Main method: Match user message to relevant skills
     */
    async matchSkills(
        userMessage: string,
        enabledSkills: SkillMetadata[]
    ): Promise<string[]> {
        if (enabledSkills.length === 0) return [];

        // 1. Check for explicit command first
        const explicit = this.detectExplicitCommand(userMessage);
        if (explicit) {
            // Verify the skill exists and is enabled
            const exists = enabledSkills.find(s => s.name === explicit);
            if (exists) return [explicit];
        }

        // 2. Try LLM matching
        try {
            const matched = await this.llmMatch(userMessage, enabledSkills);
            return matched.slice(0, SkillsMatcher.MAX_SKILLS);
        } catch (error) {
            console.error('LLM skill matching failed:', error);
            // 3. Fallback to keyword matching
            return this.keywordMatch(userMessage, enabledSkills);
        }
    }

    /**
     * Detect explicit /use-skill command
     * Format: /use-skill skill-name or /skill skill-name
     */
    detectExplicitCommand(message: string): string | null {
        // Match /use-skill skill-name or /skill skill-name at the start
        const patterns = [
            /^\/use-skill\s+([a-z0-9-]+)/i,
            /^\/skill\s+([a-z0-9-]+)/i
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match) {
                return match[1].toLowerCase();
            }
        }
        return null;
    }

    /**
     * Strip explicit command from message
     */
    stripExplicitCommand(message: string): string {
        return message
            .replace(/^\/use-skill\s+[a-z0-9-]+\s*/i, '')
            .replace(/^\/skill\s+[a-z0-9-]+\s*/i, '')
            .trim();
    }

    /**
     * LLM-based skill matching using a lightweight model
     */
    async llmMatch(
        message: string,
        skills: SkillMetadata[]
    ): Promise<string[]> {
        const settings = await getSettings();

        // Use a lightweight model for matching
        let baseUrl = settings.baseUrl;
        if (!baseUrl) {
            baseUrl = DEFAULT_PROVIDER_SETTINGS[settings.provider]?.baseUrl;
        }

        let apiKey = settings.apiKey;
        if (!apiKey) {
            apiKey = 'not-needed';
        }

        const client = new OpenAI({
            apiKey,
            baseURL: baseUrl,
            dangerouslyAllowBrowser: true
        });

        // Build skill list for prompt
        const skillList = skills
            .map((s, i) => `${i + 1}. ${s.name}: ${s.description}`)
            .join('\n');

        const prompt = `You are a skill selector. Given a user message and available skills, return ONLY the skill names (comma-separated) that are relevant to the task, or "none" if no skills match.

User message: "${message}"

Available skills:
${skillList}

Reply format: skill-name-1,skill-name-2 or none
Reply ONLY with skill names, no explanations.`;

        try {
            // Use a fast model - try gpt-4o-mini, fallback to current model
            const model = this.getMatcherModel(settings);

            const response = await client.chat.completions.create({
                model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 100,
                temperature: 0
            });

            const reply = response.choices[0]?.message?.content?.trim().toLowerCase() || 'none';

            if (reply === 'none') return [];

            // Parse comma-separated skill names
            const matched = reply
                .split(',')
                .map(s => s.trim())
                .filter(name => skills.some(skill => skill.name === name));

            return matched;
        } catch (error) {
            console.error('LLM matching error:', error);
            return [];
        }
    }

    /**
     * Get appropriate model for skill matching
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private getMatcherModel(settings: any): string {
        // Try to use a lightweight model based on provider
        switch (settings.provider) {
            case 'openai':
                return 'gpt-4o-mini';
            case 'anthropic':
                return 'claude-3-haiku-20240307';
            case 'google':
                return 'gemini-2.0-flash';
            case 'deepseek':
                return 'deepseek-chat';
            default:
                // Fallback to current model
                return settings.model || 'gpt-4o-mini';
        }
    }

    /**
     * Simple keyword-based matching (fallback)
     */
    private keywordMatch(
        message: string,
        skills: SkillMetadata[]
    ): string[] {
        const messageLower = message.toLowerCase();
        const matched: { name: string; score: number }[] = [];

        for (const skill of skills) {
            let score = 0;

            // Check if skill name appears in message
            if (messageLower.includes(skill.name.replace(/-/g, ' '))) {
                score += 10;
            }

            // Check description keywords
            const descWords = skill.description.toLowerCase().split(/\s+/);
            for (const word of descWords) {
                if (word.length > 3 && messageLower.includes(word)) {
                    score += 1;
                }
            }

            if (score > 0) {
                matched.push({ name: skill.name, score });
            }
        }

        // Return top matches sorted by score
        return matched
            .sort((a, b) => b.score - a.score)
            .slice(0, SkillsMatcher.MAX_SKILLS)
            .map(m => m.name);
    }
}

// Singleton instance
export const skillsMatcher = new SkillsMatcher();
