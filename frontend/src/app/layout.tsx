import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'ClipPilot AI',
  description: 'YouTube Shorts Automation Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen flex">
        <Sidebar />
        <main className="flex-1 ml-64 min-h-screen overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
