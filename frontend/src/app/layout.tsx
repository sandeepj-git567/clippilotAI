import type { Metadata } from 'next';
import './globals.css';
import DashboardShell from '@/components/DashboardShell';

export const metadata: Metadata = {
  title: 'ClipPilot AI — YouTube Shorts Automation Platform',
  description: 'AI-powered highlight detection, smart facecam framing, and automated publishing for YouTube Shorts.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen antialiased selection:bg-blue-600 selection:text-white">
        <DashboardShell>
          {children}
        </DashboardShell>
      </body>
    </html>
  );
}
