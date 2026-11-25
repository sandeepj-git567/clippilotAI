'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getMe } from '@/lib/api';

const navItems = [
  { href: '/', label: 'Overview', icon: '🏠' },
  { href: '/submit', label: 'Submit Video', icon: '➕' },
  { href: '/videos', label: 'Source Library', icon: '🎬' },
  { href: '/jobs', label: 'Processing Jobs', icon: '⚙️' },
  { href: '/clips', label: 'Clip Library', icon: '✂️' },
  { href: '/publishing', label: 'Publishing Queue', icon: '📤' },
  { href: '/published', label: 'Published Videos', icon: '✅' },
  { href: '/analytics', label: 'Analytics', icon: '📊' },
  { href: '/youtube', label: 'YouTube Account', icon: '▶️' },
  { href: '/backgrounds', label: 'Background Media', icon: '🖼️' },
  { href: '/presets', label: 'Editing Presets', icon: '🎨' },
  { href: '/settings', label: 'Automation Settings', icon: '⚙️' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string; email: string; avatarUrl?: string; role: string } | null>(null);

  useEffect(() => {
    // Check if token returned from Google OAuth in query parameters
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      if (token) {
        localStorage.setItem('auth_token', token);
        // Clean URL without refresh
        params.delete('token');
        params.delete('auth');
        const newSearch = params.toString() ? `?${params.toString()}` : '';
        window.history.replaceState({}, document.title, window.location.pathname + newSearch);
      }

      // Fetch user profile
      getMe()
        .then((res) => {
          if (res?.success && res.user) {
            setUser(res.user);
          }
        })
        .catch(() => {});
    }
  }, [pathname]);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      setUser(null);
      window.location.href = '/login';
    }
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-gray-900 border-r border-gray-800 flex flex-col z-50">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">ClipPilot AI</h1>
            <p className="text-gray-400 text-xs">Shorts Automation</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User & Auth Profile */}
      <div className="p-3 border-t border-gray-800 bg-gray-900/60">
        {user ? (
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-gray-800/60 border border-gray-700/50">
            <div className="flex items-center gap-2.5 overflow-hidden">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-8 h-8 rounded-full border border-blue-500/50 object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-600/30 border border-blue-500/40 text-blue-300 font-semibold text-xs flex items-center justify-center flex-shrink-0">
                  {user.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
              )}
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700/50 rounded-lg transition-colors flex-shrink-0 text-xs"
            >
              🚪
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="flex-1 text-center py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors shadow-sm"
            >
              Sign In with Google
            </Link>
          </div>
        )}
      </div>

      <div className="px-4 py-2 text-[10px] text-gray-500 flex justify-between items-center">
        <span>ClipPilot AI v1.0.0</span>
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
      </div>
    </aside>
  );
}
