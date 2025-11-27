'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { HomeContent } from '@/components/pdf/HomeContent';

/**
 * Loading skeleton for initial page load
 */
function LoadingFallback() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-surface p-4">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
          <div className="relative p-6 bg-primary/10 rounded-full">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Loading...</h2>
          <p className="text-muted-foreground max-w-md">
            Initializing PDF Editor
          </p>
        </div>
      </div>
    </main>
  );
}

/**
 * Root page component
 * Wraps HomeContent with Suspense boundary for useSearchParams
 */
export default function Home() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <HomeContent />
    </Suspense>
  );
}
