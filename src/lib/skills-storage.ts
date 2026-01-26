import yaml from 'js-yaml';
import JSZip from 'jszip';

// ============== Types ==============

export interface SkillMetadata {
    name: string;
    description: string;
    version?: string;
    author?: string;
    license?: string;
    enabled: boolean;
    createdAt: number;
    updatedAt: number;
}

export interface SkillContent extends SkillMetadata {
    instructions: string;
    allowedTools?: string[];
    scripts?: Record<string, string>;
    references?: Record<string, string>;
    assets?: Record<string, string>; // base64 encoded
}

// ============== IndexedDB Storage ==============

const DB_NAME = 'SideAgentSkillsDB';
const STORE_NAME = 'skills';
const DB_VERSION = 1;

export class SkillsStorage {
    private db: IDBDatabase | null = null;

    async open(): Promise<IDBDatabase> {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(request.result);
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'name' });
                    store.createIndex('enabled', 'enabled', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };
        });
    }

    /**
     * Save a skill to IndexedDB
     */
    async saveSkill(skill: SkillContent): Promise<void> {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(skill);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    /**
     * Load all skills (metadata only for performance)
     */
    async loadAllSkills(): Promise<SkillMetadata[]> {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const skills = request.result as SkillContent[];
                // Return only metadata fields
                const metadata: SkillMetadata[] = skills.map(s => ({
                    name: s.name,
                    description: s.description,
                    version: s.version,
                    author: s.author,
                    license: s.license,
                    enabled: s.enabled,
                    createdAt: s.createdAt,
                    updatedAt: s.updatedAt
                }));
                resolve(metadata);
            };
        });
    }

    /**
     * Load full skill content by name
     */
    async loadSkillContent(skillName: string): Promise<SkillContent | null> {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(skillName);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result || null);
        });
    }

    /**
     * Delete a skill by name
     */
    async deleteSkill(skillName: string): Promise<void> {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(skillName);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    /**
     * Update skill enabled status
     */
    async updateEnabled(skillName: string, enabled: boolean): Promise<void> {
        const skill = await this.loadSkillContent(skillName);
        if (skill) {
            skill.enabled = enabled;
            skill.updatedAt = Date.now();
            await this.saveSkill(skill);
        }
    }

    /**
     * Import skill from a .md file or .zip archive
     */
    async importSkillFromFile(file: File): Promise<SkillContent> {
        if (file.name.endsWith('.zip')) {
            return this.importFromZip(file);
        } else if (file.name.endsWith('.md')) {
            return this.importFromMarkdown(file);
        } else {
            throw new Error('Unsupported file type. Please upload .md or .zip file.');
        }
    }

    private async importFromMarkdown(file: File): Promise<SkillContent> {
        const content = await file.text();
        const { frontmatter, body } = this.parseFrontmatter(content);

        if (!frontmatter.name || !frontmatter.description) {
            throw new Error('Invalid SKILL.md: missing required fields (name, description)');
        }

        const skill: SkillContent = {
            name: frontmatter.name,
            description: frontmatter.description,
            version: frontmatter.metadata?.version,
            author: frontmatter.metadata?.author,
            license: frontmatter.license,
            enabled: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            instructions: body,
            allowedTools: frontmatter.metadata?.['allowed-tools']
        };

        await this.saveSkill(skill);
        return skill;
    }

    private async importFromZip(file: File): Promise<SkillContent> {
        const zip = await JSZip.loadAsync(file);

        // Find SKILL.md
        let skillMdContent: string | null = null;
        let skillMdPath: string | null = null;

        for (const path of Object.keys(zip.files)) {
            if (path.endsWith('SKILL.md') || path.endsWith('skill.md')) {
                skillMdContent = await zip.files[path].async('string');
                skillMdPath = path;
                break;
            }
        }

        if (!skillMdContent) {
            throw new Error('No SKILL.md found in the zip archive');
        }

        const { frontmatter, body } = this.parseFrontmatter(skillMdContent);

        if (!frontmatter.name || !frontmatter.description) {
            throw new Error('Invalid SKILL.md: missing required fields (name, description)');
        }

        // Extract scripts, references, assets
        const scripts: Record<string, string> = {};
        const references: Record<string, string> = {};
        const assets: Record<string, string> = {};
        const baseDir = skillMdPath ? skillMdPath.substring(0, skillMdPath.lastIndexOf('/') + 1) : '';

        for (const [path, zipEntry] of Object.entries(zip.files)) {
            if (zipEntry.dir || path === skillMdPath) continue;

            const relativePath = path.startsWith(baseDir) ? path.substring(baseDir.length) : path;

            if (relativePath.startsWith('scripts/')) {
                scripts[relativePath] = await zipEntry.async('string');
            } else if (relativePath.startsWith('references/')) {
                references[relativePath] = await zipEntry.async('string');
            } else if (relativePath.startsWith('assets/')) {
                assets[relativePath] = await zipEntry.async('base64');
            }
        }

        const skill: SkillContent = {
            name: frontmatter.name,
            description: frontmatter.description,
            version: frontmatter.metadata?.version,
            author: frontmatter.metadata?.author,
            license: frontmatter.license,
            enabled: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            instructions: body,
            allowedTools: frontmatter.metadata?.['allowed-tools'],
            scripts: Object.keys(scripts).length > 0 ? scripts : undefined,
            references: Object.keys(references).length > 0 ? references : undefined,
            assets: Object.keys(assets).length > 0 ? assets : undefined
        };

        await this.saveSkill(skill);
        return skill;
    }

    /**
     * Export skill as a zip file
     */
    async exportSkill(skillName: string): Promise<Blob> {
        const skill = await this.loadSkillContent(skillName);
        if (!skill) {
            throw new Error(`Skill not found: ${skillName}`);
        }

        const zip = new JSZip();
        const folder = zip.folder(skill.name);
        if (!folder) throw new Error('Failed to create zip folder');

        // Create SKILL.md
        const frontmatterObj: Record<string, unknown> = {
            name: skill.name,
            description: skill.description
        };
        if (skill.license) frontmatterObj.license = skill.license;
        if (skill.version || skill.author || skill.allowedTools) {
            frontmatterObj.metadata = {};
            if (skill.version) (frontmatterObj.metadata as Record<string, unknown>).version = skill.version;
            if (skill.author) (frontmatterObj.metadata as Record<string, unknown>).author = skill.author;
            if (skill.allowedTools) (frontmatterObj.metadata as Record<string, unknown>)['allowed-tools'] = skill.allowedTools;
        }

        const skillMdContent = `---\n${yaml.dump(frontmatterObj)}---\n\n${skill.instructions}`;
        folder.file('SKILL.md', skillMdContent);

        // Add scripts
        if (skill.scripts) {
            for (const [path, content] of Object.entries(skill.scripts)) {
                folder.file(path, content);
            }
        }

        // Add references
        if (skill.references) {
            for (const [path, content] of Object.entries(skill.references)) {
                folder.file(path, content);
            }
        }

        // Add assets (base64 -> binary)
        if (skill.assets) {
            for (const [path, base64Content] of Object.entries(skill.assets)) {
                folder.file(path, base64Content, { base64: true });
            }
        }

        return zip.generateAsync({ type: 'blob' });
    }

    /**
     * Parse YAML frontmatter from markdown content
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parseFrontmatter(content: string): { frontmatter: Record<string, any>; body: string } {
        const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
        const match = content.match(frontmatterRegex);

        if (!match) {
            throw new Error('Invalid SKILL.md format: missing YAML frontmatter');
        }

        const [, frontmatterText, body] = match;

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const frontmatter = yaml.load(frontmatterText) as Record<string, any>;
            return { frontmatter, body: body.trim() };
        } catch (error) {
            throw new Error(`YAML parsing error: ${(error as Error).message}`);
        }
    }
}

export const skillsStorage = new SkillsStorage();
