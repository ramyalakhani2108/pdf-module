import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { PdfFile, PdfInput, InputType } from '@/lib/types';

interface EditorState {
    // PDF State
    currentPdf: PdfFile | null;
    currentPage: number;
    totalPages: number;

    // Fields State
    fields: PdfInput[];
    selectedFieldId: string | null;

    // UI State
    isLoading: boolean;
    error: string | null;

    // Actions
    setPdf: (pdf: PdfFile | null) => void;
    setCurrentPage: (page: number) => void;
    setFields: (fields: PdfInput[]) => void;
    addField: (field: Omit<PdfInput, 'id' | 'createdAt' | 'updatedAt'>) => void;
    updateField: (id: string, updates: Partial<PdfInput>) => void;
    deleteField: (id: string) => void;
    selectField: (id: string | null) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    reset: () => void;
}

const initialState = {
    currentPdf: null,
    currentPage: 1,
    totalPages: 0,
    fields: [],
    selectedFieldId: null,
    isLoading: false,
    error: null,
};

export const useEditorStore = create<EditorState>()(
    persist(
        (set) => ({
            ...initialState,

            setPdf: (pdf) => {
                set({
                    currentPdf: pdf,
                    totalPages: pdf?.pageCount || 0,
                    currentPage: 1
                });
            },

            setCurrentPage: (page) => set({ currentPage: page }),

            setFields: (fields) => set({ fields }),

            addField: (field) => set((state) => ({
                fields: [
                    ...state.fields,
                    {
                        ...field,
                        id: crypto.randomUUID(),
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    } as PdfInput,
                ],
            })),

            updateField: (id, updates) => set((state) => ({
                fields: state.fields.map((field) =>
                    field.id === id ? { ...field, ...updates, updatedAt: new Date() } : field
                ),
            })),

            deleteField: (id) => set((state) => ({
                fields: state.fields.filter((field) => field.id !== id),
                selectedFieldId: state.selectedFieldId === id ? null : state.selectedFieldId,
            })),

            selectField: (id) => set({ selectedFieldId: id }),

            setLoading: (loading) => set({ isLoading: loading }),

            setError: (error) => set({ error }),

            reset: () => set(initialState),
        }),
        {
            name: 'pdf-editor-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                currentPdf: state.currentPdf,
                currentPage: state.currentPage,
                totalPages: state.totalPages,
                fields: state.fields,
            }),
        }
    )
);
