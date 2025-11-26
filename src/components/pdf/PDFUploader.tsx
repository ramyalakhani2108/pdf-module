'use client';

import { useState, useCallback } from 'react';
import { Upload, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { useEditorStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { cn, formatBytes } from '@/lib/utils';

const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'api_key';

export function PDFUploader() {
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const setPdf = useEditorStore((state) => state.setPdf);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setIsDragging(true);
        } else if (e.type === 'dragleave') {
            setIsDragging(false);
        }
    }, []);

    const handleUpload = async (file: File) => {
        if (file.type !== 'application/pdf') {
            setError('Please upload a valid PDF file');
            return;
        }

        setUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/pdf/upload', {
                method: 'POST',
                headers: {
                    'x-api-key': API_KEY,
                },
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to upload PDF');
            }

            setPdf(data.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleUpload(e.dataTransfer.files[0]);
        }
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleUpload(e.target.files[0]);
        }
    };

    return (
        <div className="w-full max-w-xl mx-auto p-6">
            <div
                className={cn(
                    "relative border-2 border-dashed rounded-xl p-10 transition-all duration-200 ease-in-out text-center cursor-pointer",
                    isDragging
                        ? "border-primary bg-primary/5 scale-[1.02]"
                        : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
                    uploading && "opacity-50 pointer-events-none"
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('pdf-upload')?.click()}
            >
                <input
                    id="pdf-upload"
                    type="file"
                    className="hidden"
                    accept="application/pdf"
                    onChange={handleChange}
                />

                <div className="flex flex-col items-center gap-4">
                    <div className={cn(
                        "p-4 rounded-full bg-primary/10 text-primary transition-transform duration-300",
                        isDragging && "scale-110"
                    )}>
                        {uploading ? (
                            <Loader2 className="w-8 h-8 animate-spin" />
                        ) : (
                            <Upload className="w-8 h-8" />
                        )}
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-xl font-semibold tracking-tight">
                            {uploading ? 'Uploading PDF...' : 'Upload your PDF'}
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                            Drag and drop your PDF file here, or click to browse.
                            Max file size 10MB.
                        </p>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-md animate-fade-in">
                            <AlertCircle className="w-4 h-4" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { icon: FileText, title: 'Smart Detection', desc: 'Auto-detects pages' },
                    { icon: Upload, title: 'Secure Upload', desc: 'Encrypted storage' },
                    { icon: Loader2, title: 'Fast Processing', desc: 'Instant preview' }
                ].map((feature, i) => (
                    <div key={i} className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
                        <feature.icon className="w-5 h-5 text-primary mb-2" />
                        <h4 className="font-medium text-sm">{feature.title}</h4>
                        <p className="text-xs text-muted-foreground">{feature.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
