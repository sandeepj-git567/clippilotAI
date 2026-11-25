'use client';

import { useEffect, useState } from 'react';
import { getYouTubeStatus, connectYouTube, disconnectYouTube } from '@/lib/api';

interface YouTubeAccount {
  id: string;
  channelId: string;
  channelTitle: string;
  channelCustomUrl?: string;
  channelThumbnail?: string;
  isConnected: boolean;
  tokenExpiry: string;
  scopes: string[];
}

export default function YouTubePage() {
  const [accounts, setAccounts] = useState<YouTubeAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getYouTubeStatus()
      .then((d) => setAccounts(Array.isArray(d) ? d : d?.accounts ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleConnect = async () => {
    try {
      const res = await connectYouTube();
      const targetUrl = res?.authUrl || res;
      if (typeof targetUrl === 'string' && targetUrl.startsWith('http')) {
        window.location.assign(targetUrl);
      } else {
        alert('Did not receive a valid authorization URL from server.');
      }
    } catch (e: any) {
      alert(e.message || 'Failed to initiate YouTube connection');
    }
  };

  const handleDisconnect = async (accountId: string) => {
    if (!confirm('Disconnect this YouTube account?')) return;
    try {
      await disconnectYouTube(accountId);
      load();
    } catch (e: any) {
      alert(e.message || 'Failed to disconnect account');
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">YouTube Account Integration</h2>
          <p className="text-gray-400 mt-1">Manage connected channels for automated Shorts publishing</p>
        </div>
        <a
          href="http://localhost:8000/api/youtube/connect"
          className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-lg"
        >
          <span>▶️</span> Connect YouTube Channel
        </a>
      </div>

      {loading && <div className="text-gray-400 text-center py-16">Loading account status...</div>}
      {error && <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg p-4 mb-4">{error}</div>}

      {!loading && !error && accounts.length === 0 && (
        <div className="bg-gray-800 rounded-xl p-12 text-center border border-gray-700">
          <p className="text-5xl mb-4">📺</p>
          <h3 className="text-white font-semibold text-lg mb-2">No YouTube Channel Connected</h3>
          <p className="text-gray-400 max-w-md mx-auto mb-6">
            Connect your YouTube channel using Google OAuth 2.0 to automatically publish generated Shorts.
          </p>
          <a
            href="http://localhost:8000/api/youtube/connect"
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold inline-flex items-center gap-2"
          >
            <span>▶️</span> Connect with Google
          </a>
        </div>
      )}

      {!loading && accounts.length > 0 && (
        <div className="space-y-4">
          {accounts.map((acc) => (
            <div key={acc.id} className="bg-gray-800 rounded-xl p-6 border border-gray-750 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {acc.channelThumbnail ? (
                  <img src={acc.channelThumbnail} alt={acc.channelTitle} className="w-14 h-14 rounded-full border-2 border-red-500" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-red-900 flex items-center justify-center text-2xl font-bold text-white">
                    ▶
                  </div>
                )}
                <div>
                  <h3 className="text-white font-bold text-lg">{acc.channelTitle}</h3>
                  <p className="text-xs text-gray-400 font-mono">Channel ID: {acc.channelId}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${acc.isConnected ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                      {acc.isConnected ? '● Connected' : 'Disconnected'}
                    </span>
                    <span className="text-xs text-gray-400">
                      Token valid until: {new Date(acc.tokenExpiry).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                {acc.isConnected ? (
                  <button
                    onClick={() => handleDisconnect(acc.id)}
                    className="text-xs text-red-400 hover:text-red-300 border border-red-800 hover:border-red-700 px-3 py-1.5 rounded transition-colors"
                  >
                    Disconnect Channel
                  </button>
                ) : (
                  <button
                    onClick={handleConnect}
                    className="text-xs text-blue-400 hover:text-blue-300 border border-blue-800 hover:border-blue-700 px-3 py-1.5 rounded transition-colors"
                  >
                    Reconnect Channel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
