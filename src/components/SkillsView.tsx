import { useState, useEffect, useRef } from 'react';
import { skillsManager } from '../lib/skills-manager';
import type { SkillMetadata, SkillContent } from '../lib/skills-storage';
import {
    Zap, Upload, Download, Trash2, X,
    ChevronDown, ChevronRight, FileText, AlertCircle, Check
} from 'lucide-react';

interface SkillsViewProps {
    onSkillsChange?: () => void;
}

export const SkillsView = ({ onSkillsChange }: SkillsViewProps) => {
    const [skills, setSkills] = useState<SkillMetadata[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedSkill, setSelectedSkill] = useState<SkillContent | null>(null);
    const [importing, setImporting] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadSkills();
    }, []);

    const loadSkills = async () => {
        try {
            setLoading(true);
            await skillsManager.initialize();
            const allSkills = await skillsManager.getAllSkills();
            setSkills(allSkills);
            setError(null);
        } catch (err) {
            setError('Failed to load skills');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (skillName: string, enabled: boolean) => {
        try {
            await skillsManager.toggleSkill(skillName, enabled);
            setSkills(prev => prev.map(s =>
                s.name === skillName ? { ...s, enabled } : s
            ));
            onSkillsChange?.();
        } catch (err) {
            console.error('Failed to toggle skill:', err);
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            await importFile(file);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith('.md') || file.name.endsWith('.zip'))) {
            await importFile(file);
        } else {
            setError('Please drop a .md or .zip file');
        }
    };

    const importFile = async (file: File) => {
        try {
            setImporting(true);
            setError(null);
            await skillsManager.importSkill(file);
            await loadSkills();
            onSkillsChange?.();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setImporting(false);
        }
    };

    const handleExport = async (skillName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const blob = await skillsManager.exportSkill(skillName);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = skillName + '.zip';
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handleDelete = async (skillName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Delete skill "' + skillName + '"?')) return;

        try {
            await skillsManager.deleteSkill(skillName);
            setSkills(prev => prev.filter(s => s.name !== skillName));
            if (selectedSkill?.name === skillName) {
                setSelectedSkill(null);
            }
            onSkillsChange?.();
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handleViewDetails = async (skillName: string) => {
        if (expandedSkill === skillName) {
            setExpandedSkill(null);
            return;
        }

        try {
            const content = await skillsManager.loadSkill(skillName);
            setSelectedSkill(content);
            setExpandedSkill(skillName);
        } catch (err) {
            console.error('Failed to load skill details:', err);
        }
    };

    if (loading) {
        return (
            <div className="p-4 text-center text-gray-500 text-sm">
                Loading skills...
            </div>
        );
    }

    const getToggleClass = (enabled: boolean) => {
        return 'w-8 h-4 rounded-full relative transition-colors ' +
            (enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600');
    };

    const getToggleKnobClass = (enabled: boolean) => {
        return 'absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ' +
            (enabled ? 'left-4' : 'left-0.5');
    };

    const getCardClass = (skillName: string) => {
        return 'rounded-lg border transition-all ' +
            (expandedSkill === skillName
                ? 'border-blue-500 ring-1 ring-blue-500'
                : 'border-gray-200 dark:border-gray-700');
    };

    const getDropZoneClass = () => {
        return 'border-2 border-dashed rounded-lg p-4 text-center transition-colors ' +
            (dragOver
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700');
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-end">
                <button
                    onClick={handleImportClick}
                    disabled={importing}
                    className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 disabled:opacity-50"
                >
                    <Upload size={14} />
                    {importing ? 'Importing...' : 'Import Skill'}
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".md,.zip"
                    onChange={handleFileSelect}
                    className="hidden"
                />
            </div>

            {error && (
                <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs rounded-lg border border-red-200 dark:border-red-800">
                    <AlertCircle size={14} />
                    {error}
                    <button onClick={() => setError(null)} className="ml-auto">
                        <X size={12} />
                    </button>
                </div>
            )}

            <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={getDropZoneClass()}
            >
                <FileText size={24} className="mx-auto mb-2 text-gray-400" />
                <p className="text-xs text-gray-500">
                    Drag & drop a <span className="font-mono">.md</span> or <span className="font-mono">.zip</span> skill file here
                </p>
            </div>

            <div className="space-y-2">
                {skills.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                        <Zap size={32} className="mx-auto mb-2 opacity-50" />
                        <p>No skills installed</p>
                        <p className="text-xs mt-1">Import a skill to get started</p>
                    </div>
                ) : (
                    skills.map(skill => (
                        <div key={skill.name} className={getCardClass(skill.name)}>
                            <div
                                className="p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                onClick={() => handleViewDetails(skill.name)}
                            >
                                <Zap size={16} className={skill.enabled ? 'text-yellow-500' : 'text-gray-400'} />

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm truncate">{skill.name}</span>
                                        {skill.version && (
                                            <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-500">
                                                v{skill.version}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 truncate">{skill.description}</p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggle(skill.name, !skill.enabled);
                                        }}
                                        className={getToggleClass(skill.enabled)}
                                    >
                                        <div className={getToggleKnobClass(skill.enabled)} />
                                    </button>

                                    <button
                                        onClick={(e) => handleExport(skill.name, e)}
                                        className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                                        title="Export"
                                    >
                                        <Download size={14} />
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(skill.name, e)}
                                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                        title="Delete"
                                    >
                                        <Trash2 size={14} />
                                    </button>

                                    {expandedSkill === skill.name ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </div>
                            </div>

                            {expandedSkill === skill.name && selectedSkill && (
                                <div className="p-3 pt-0 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                                    <div className="flex flex-wrap gap-2 mb-3 text-[10px]">
                                        {selectedSkill.author && (
                                            <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                                                Author: {selectedSkill.author}
                                            </span>
                                        )}
                                        {selectedSkill.license && (
                                            <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                                                License: {selectedSkill.license}
                                            </span>
                                        )}
                                        {selectedSkill.allowedTools && selectedSkill.allowedTools.length > 0 && (
                                            <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
                                                Tools: {selectedSkill.allowedTools.join(', ')}
                                            </span>
                                        )}
                                    </div>

                                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 max-h-48 overflow-y-auto">
                                        <pre className="text-[10px] text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-mono">
                                            {selectedSkill.instructions.slice(0, 1000)}
                                            {selectedSkill.instructions.length > 1000 && '...'}
                                        </pre>
                                    </div>

                                    {(selectedSkill.scripts || selectedSkill.references || selectedSkill.assets) && (
                                        <div className="mt-2 text-[10px] text-gray-500">
                                            <span className="font-medium">Includes: </span>
                                            {selectedSkill.scripts && Object.keys(selectedSkill.scripts).length + ' scripts'}
                                            {selectedSkill.references && ', ' + Object.keys(selectedSkill.references).length + ' references'}
                                            {selectedSkill.assets && ', ' + Object.keys(selectedSkill.assets).length + ' assets'}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            <div className="text-[10px] text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">
                <p className="flex items-center gap-1">
                    <Check size={10} />
                    Skills are automatically matched to your messages
                </p>
                <p className="flex items-center gap-1 mt-1">
                    <Check size={10} />
                    Use <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">/use-skill skill-name</span> to explicitly invoke a skill
                </p>
            </div>
        </div>
    );
};
