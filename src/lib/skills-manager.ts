import { skillsStorage, type SkillMetadata, type SkillContent } from './skills-storage';

/**
 * SkillsManager - Business logic layer for managing skills
 * 
 * Provides:
 * - Initialization and lifecycle management
 * - In-memory caching of loaded skills
 * - Enabled/disabled skill filtering
 */
export class SkillsManager {
    private loadedSkills: Map<string, SkillContent> = new Map();
    private metadataCache: SkillMetadata[] = [];
    private initialized = false;

    /**
     * Initialize the skills manager
     * Loads all skill metadata into cache
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            this.metadataCache = await skillsStorage.loadAllSkills();
            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize SkillsManager:', error);
            this.metadataCache = [];
            this.initialized = true; // Mark as initialized to avoid retry loops
        }
    }

    /**
     * Refresh the metadata cache
     */
    async refresh(): Promise<void> {
        this.metadataCache = await skillsStorage.loadAllSkills();
    }

    /**
     * Get all skills metadata
     */
    async getAllSkills(): Promise<SkillMetadata[]> {
        if (!this.initialized) await this.initialize();
        return this.metadataCache;
    }

    /**
     * Get only enabled skills metadata
     */
    async getEnabledSkills(): Promise<SkillMetadata[]> {
        if (!this.initialized) await this.initialize();
        return this.metadataCache.filter(s => s.enabled);
    }

    /**
     * Load full skill content (with caching)
     */
    async loadSkill(skillName: string): Promise<SkillContent | null> {
        // Check cache first
        if (this.loadedSkills.has(skillName)) {
            return this.loadedSkills.get(skillName)!;
        }

        // Load from storage
        const skill = await skillsStorage.loadSkillContent(skillName);
        if (skill) {
            this.loadedSkills.set(skillName, skill);
        }
        return skill;
    }

    /**
     * Toggle skill enabled status
     */
    async toggleSkill(skillName: string, enabled: boolean): Promise<void> {
        await skillsStorage.updateEnabled(skillName, enabled);

        // Update cache
        const idx = this.metadataCache.findIndex(s => s.name === skillName);
        if (idx !== -1) {
            this.metadataCache[idx].enabled = enabled;
        }

        // Update loaded cache if present
        const loaded = this.loadedSkills.get(skillName);
        if (loaded) {
            loaded.enabled = enabled;
        }
    }

    /**
     * Import a skill from file
     */
    async importSkill(file: File): Promise<SkillContent> {
        const skill = await skillsStorage.importSkillFromFile(file);

        // Update metadata cache
        const existingIdx = this.metadataCache.findIndex(s => s.name === skill.name);
        const metadata: SkillMetadata = {
            name: skill.name,
            description: skill.description,
            version: skill.version,
            author: skill.author,
            license: skill.license,
            enabled: skill.enabled,
            createdAt: skill.createdAt,
            updatedAt: skill.updatedAt
        };

        if (existingIdx !== -1) {
            this.metadataCache[existingIdx] = metadata;
        } else {
            this.metadataCache.push(metadata);
        }

        // Update loaded cache
        this.loadedSkills.set(skill.name, skill);

        return skill;
    }

    /**
     * Export skill as zip blob
     */
    async exportSkill(skillName: string): Promise<Blob> {
        return skillsStorage.exportSkill(skillName);
    }

    /**
     * Delete a skill
     */
    async deleteSkill(skillName: string): Promise<void> {
        await skillsStorage.deleteSkill(skillName);

        // Update caches
        this.metadataCache = this.metadataCache.filter(s => s.name !== skillName);
        this.loadedSkills.delete(skillName);
    }

    /**
     * Clear loaded skills cache (memory optimization)
     */
    clearCache(): void {
        this.loadedSkills.clear();
    }

    /**
     * Get skill by name from metadata cache
     */
    getSkillMetadata(skillName: string): SkillMetadata | undefined {
        return this.metadataCache.find(s => s.name === skillName);
    }
}

// Singleton instance
export const skillsManager = new SkillsManager();
