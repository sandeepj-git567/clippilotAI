'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavGroup {
  title: string;
  items: {
    href: string;
    label: string;
    icon: string;
    badge?: string;
  }[];
}

const navGroups: NavGroup[] = [
  {
    title: 'Creation & Pipeline',
    items: [
      { href: '/', label: 'Overview', icon: '⚡' },
      { href: '/submit', label: 'Submit Video', icon: '➕' },
      { href: '/jobs', label: 'Processing Jobs', icon: '⚙️' },
    ],
  },
  {
    title: 'Content & Media',
    items: [
      { href: '/videos', label: 'Source Library', icon: '🎬' },
      { href: '/clips', label: 'Clip Library', icon: '✂️' },
      { href: '/backgrounds', label: 'Background Media', icon: '🖼️' },
      { href: '/presets', label: 'Editing Presets', icon: '🎨' },
    ],
  },
  {
    title: 'Publishing & Channels',
    items: [
      { href: '/publishing', label: 'Publishing Queue', icon: '📤' },
      { href: '/published', label: 'Published Shorts', icon: '✅' },
      { href: '/youtube', label: 'YouTube Account', icon: '▶️' },
      { href: '/analytics', label: 'Analytics', icon: '📊' },
    ],
  },
  {
    title: 'System',
    items: [
      { href: '/settings', label: 'Automation Settings', icon: '🔧' },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-gray-900/95 border-r border-gray-800/80 flex flex-col z-50 transition-transform duration-200 ease-in-out backdrop-blur-md ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-gray-800/80 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group" onClick={onClose}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-lg shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              🎯
            </div>
            <div>
              <h1 className="text-white font-bold text-base leading-tight tracking-tight flex items-center gap-1.5">
                ClipPilot AI
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Pro
                </span>
              </h1>
              <p className="text-gray-400 text-xs">Shorts Automation</p>
            </div>
          </Link>

          {/* Close button for mobile */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-gray-800">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                {group.title}
              </p>
              {group.items.map((item) => {
                const isActive =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname === item.href || pathname.startsWith(item.href + '/');

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                        : 'text-gray-300 hover:text-white hover:bg-gray-800/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="text-sm opacity-90">{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* System Status Footer */}
        <div className="p-3.5 border-t border-gray-800/80 bg-gray-900/60">
          <div className="flex items-center justify-between text-xs text-gray-400 px-1 py-1">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-medium text-gray-300">AI Engine Online</span>
            </div>
            <span className="text-[10px] font-mono text-gray-400">v2.0</span>
          </div>
        </div>
      </aside>
    </>
  );
}
