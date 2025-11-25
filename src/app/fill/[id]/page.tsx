import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { PDFFormFiller } from '@/components/pdf/PDFFormFiller';
import { FileText } from 'lucide-react';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function FillPage({ params }: PageProps) {
    const { id } = await params;

    const pdf = await prisma.pdfFile.findUnique({
        where: { id },
        include: {
            inputs: true,
        },
    });

    if (!pdf) {
        notFound();
    }

    return (
        <main className="h-screen flex flex-col bg-background overflow-hidden">
            <header className="h-14 border-b flex items-center justify-between px-4 bg-background/80 backdrop-blur-sm z-50">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                        <FileText className="w-4 h-4" />
                    </div>
                    <span className="font-medium text-sm truncate max-w-[200px]">
                        {pdf.fileName}
                    </span>
                </div>
            </header>

            <div className="flex-1 overflow-hidden">
                <PDFFormFiller pdf={pdf} fields={pdf.inputs} />
            </div>
        </main>
    );
}
