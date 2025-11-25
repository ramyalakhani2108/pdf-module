'use client';

import { useEffect } from 'react';
import { useEditorStore } from '@/lib/store';
import { PDFUploader } from '@/components/pdf/PDFUploader';
import { PDFCanvas } from '@/components/pdf/PDFCanvas';
import { Sidebar } from '@/components/pdf/Sidebar';
import { FileText, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Home() {
  const { currentPdf, setPdf, reset } = useEditorStore();

  // Reset store on mount
  useEffect(() => {
    // Check if we have a PDF ID in URL (for editing existing)
    // For now, we start fresh
  }, []);

  if (!currentPdf) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]" />
        <div className="absolute h-full w-full bg-background [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />

        <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-4xl">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary/10 text-primary mb-4">
              <FileText className="w-8 h-8" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70">
              PDF Field Editor
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Transform static PDFs into dynamic forms. Drag, drop, and configure fields with pixel-perfect precision.
            </p>
          </div>

          <PDFUploader />
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b flex items-center justify-between px-4 bg-background/80 backdrop-blur-sm z-50">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm truncate max-w-[200px]">
              {currentPdf.fileName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`/fill/${currentPdf.id}`} target="_blank" rel="noopener noreferrer">
              Preview Form
            </a>
          </Button>
        </div>
      </header>

      {/* Editor Workspace */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <PDFCanvas />
        </div>
        <Sidebar />
      </div>
    </main>
  );
}
