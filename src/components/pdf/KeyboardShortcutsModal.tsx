'use client';

import { X, Keyboard, Command, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Trash2, Copy, ZoomIn, ZoomOut, Undo, Redo, Save } from 'lucide-react';
import { useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface KeyboardShortcutsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ShortcutItem {
    keys: string[];
    description: string;
    icon?: React.ElementType;
    category: 'selection' | 'movement' | 'editing' | 'view' | 'general';
}

const shortcuts: ShortcutItem[] = [
    // Selection & General
    { keys: ['Delete', 'Backspace'], description: 'Delete selected field', icon: Trash2, category: 'selection' },
    { keys: ['⌘/Ctrl', 'D'], description: 'Duplicate selected field', icon: Copy, category: 'selection' },
    { keys: ['Escape'], description: 'Deselect all fields', category: 'selection' },
    { keys: ['⌘/Ctrl', 'A'], description: 'Select all fields on page', category: 'selection' },
    
    // Movement
    { keys: ['↑'], description: 'Move field up (1px)', icon: ArrowUp, category: 'movement' },
    { keys: ['↓'], description: 'Move field down (1px)', icon: ArrowDown, category: 'movement' },
    { keys: ['←'], description: 'Move field left (1px)', icon: ArrowLeft, category: 'movement' },
    { keys: ['→'], description: 'Move field right (1px)', icon: ArrowRight, category: 'movement' },
    { keys: ['Shift', '↑↓←→'], description: 'Move field (10px)', category: 'movement' },
    { keys: ['⌘/Ctrl', '↑↓←→'], description: 'Move field (50px)', category: 'movement' },
    
    // Editing
    { keys: ['⌘/Ctrl', 'Z'], description: 'Undo last action', icon: Undo, category: 'editing' },
    { keys: ['⌘/Ctrl', 'Shift', 'Z'], description: 'Redo last action', icon: Redo, category: 'editing' },
    { keys: ['⌘/Ctrl', 'S'], description: 'Save all fields', icon: Save, category: 'editing' },
    
    // View
    { keys: ['⌘/Ctrl', '+'], description: 'Zoom in', icon: ZoomIn, category: 'view' },
    { keys: ['⌘/Ctrl', '-'], description: 'Zoom out', icon: ZoomOut, category: 'view' },
    { keys: ['⌘/Ctrl', '0'], description: 'Reset zoom to 100%', category: 'view' },
    { keys: ['G'], description: 'Toggle grid', category: 'view' },
    { keys: ['R'], description: 'Toggle rulers', category: 'view' },
    { keys: ['⌘/Ctrl', 'Shift', 'H'], description: 'Highlight all fields by type (color-coded)', category: 'view' },
    { keys: ['?'], description: 'Show keyboard shortcuts', icon: Keyboard, category: 'general' },
];

const categoryLabels: Record<string, string> = {
    selection: 'Selection & Fields',
    movement: 'Movement',
    editing: 'Editing',
    view: 'View',
    general: 'General',
};

const categoryIcons: Record<string, React.ElementType> = {
    selection: Copy,
    movement: ArrowUp,
    editing: Save,
    view: ZoomIn,
    general: Keyboard,
};

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
    // Close on escape key
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, handleKeyDown]);

    if (!isOpen) return null;

    const categories = ['selection', 'movement', 'editing', 'view', 'general'];

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />
            
            {/* Modal */}
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden animate-scale-in mx-4">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-linear-to-r from-blue-600 to-indigo-600">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <Keyboard className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Keyboard Shortcuts</h2>
                            <p className="text-sm text-blue-100">Speed up your workflow with these shortcuts</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
                        title="Close (Escape)"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto max-h-[calc(85vh-80px)] p-6">
                    <div className="grid gap-6">
                        {categories.map((category) => {
                            const categoryShortcuts = shortcuts.filter(s => s.category === category);
                            if (categoryShortcuts.length === 0) return null;
                            
                            const CategoryIcon = categoryIcons[category];
                            
                            return (
                                <div key={category} className="space-y-3">
                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                        <CategoryIcon className="w-4 h-4" />
                                        <h3 className="text-sm font-semibold uppercase tracking-wider">
                                            {categoryLabels[category]}
                                        </h3>
                                    </div>
                                    <div className="grid gap-2">
                                        {categoryShortcuts.map((shortcut, idx) => (
                                            <div 
                                                key={idx}
                                                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    {shortcut.icon && (
                                                        <shortcut.icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                                                    )}
                                                    <span className="text-sm text-slate-700 dark:text-slate-200">
                                                        {shortcut.description}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {shortcut.keys.map((key, keyIdx) => (
                                                        <span key={keyIdx} className="flex items-center gap-1">
                                                            {keyIdx > 0 && <span className="text-slate-400 text-xs mx-0.5">+</span>}
                                                            <kbd className={cn(
                                                                "px-2 py-1 text-xs font-medium rounded",
                                                                "bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600",
                                                                "text-slate-700 dark:text-slate-200 shadow-sm",
                                                                "min-w-6 text-center"
                                                            )}>
                                                                {key}
                                                            </kbd>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer tip */}
                    <div className="mt-6 p-4 bg-linear-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                        <div className="flex items-start gap-3">
                            <div className="p-1.5 bg-blue-500 rounded-lg">
                                <Command className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                    Pro Tip
                                </p>
                                <p className="text-sm text-blue-700 dark:text-blue-300">
                                    Use <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border text-xs mx-1">Shift</kbd> + Arrow keys for 10px movement, or <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border text-xs mx-1">⌘/Ctrl</kbd> + Arrow keys for 50px movement.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
