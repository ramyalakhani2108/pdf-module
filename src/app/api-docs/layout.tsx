import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Documentation - PDF Module',
  description: 'Interactive API documentation for the PDF Module REST API',
};

export default function ApiDocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      {children}
    </div>
  );
}
