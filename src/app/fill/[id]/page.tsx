import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { PDFFormFiller } from '@/components/pdf/PDFFormFiller';
import { PdfInput } from '@/lib/types';

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

    // Cast inputs to match PdfInput type (Prisma returns string for enums)
    const fields = pdf.inputs as unknown as PdfInput[];

    return (
        <main className="h-screen flex flex-col bg-background overflow-hidden">
            <div className="flex-1 overflow-hidden">
                <PDFFormFiller pdf={pdf} fields={fields} isImported={true} />
            </div>
        </main>
    );
}
