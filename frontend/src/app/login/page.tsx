'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    // Application login removed - redirect straight to main dashboard
    router.replace('/');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-6 text-gray-400">
      <div className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 shadow-lg">
        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
        <span className="text-sm">Opening ClipPilot AI Dashboard...</span>
      </div>
    </div>
  );
}
