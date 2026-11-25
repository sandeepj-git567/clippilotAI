'use client';

import { useEffect, useState } from 'react';
import { getSettings, updateSettings } from '@/lib/api';

interface Settings {
  autoPublishEnabled: boolean;
  maxDailyUploads: number;
  preferredPostingTimes: string[];
  timezone: string;
  paused: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSettings()
      .then((d) => setSettings(d.settings || d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    try {
      await updateSettings(settings as unknown as Record<string, unknown>);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      alert(e.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl">
      <h2 className="text-2xl font-bold text-white mb-2">Automation Settings</h2>
      <p className="text-gray-400 mb-8">Configure your YouTube Shorts automated publishing cadence and limits</p>

      {loading && <div className="text-gray-400 py-16">Loading settings...</div>}
      {error && <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg p-4 mb-4">{error}</div>}

      {!loading && settings && (
        <form onSubmit={handleSave} className="bg-gray-800 rounded-xl p-6 border border-gray-750 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-gray-700">
            <div>
              <h3 className="text-white font-medium">Auto-Publish Approved Clips</h3>
              <p className="text-xs text-gray-400">Automatically upload approved clips to YouTube according to schedule</p>
            </div>
            <input
              type="checkbox"
              checked={settings.autoPublishEnabled}
              onChange={(e) => setSettings({ ...settings, autoPublishEnabled: e.target.checked })}
              className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between pb-4 border-b border-gray-700">
            <div>
              <h3 className="text-white font-medium">Pause Automation</h3>
              <p className="text-xs text-gray-400">Temporarily freeze all background publishing jobs</p>
            </div>
            <input
              type="checkbox"
              checked={settings.paused}
              onChange={(e) => setSettings({ ...settings, paused: e.target.checked })}
              className="w-5 h-5 accent-yellow-600 rounded cursor-pointer"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-white block mb-1">Max Daily Uploads</label>
            <p className="text-xs text-gray-400 mb-2">Recommended: 2–4 uploads daily to avoid spam flags</p>
            <input
              type="number"
              min={1}
              max={10}
              value={settings.maxDailyUploads}
              onChange={(e) => setSettings({ ...settings, maxDailyUploads: parseInt(e.target.value, 10) || 1 })}
              className="w-32 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-white block mb-1">Timezone</label>
            <input
              type="text"
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              className="w-64 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm"
            />
          </div>

          <div className="pt-4 flex items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            {saved && <span className="text-green-400 text-sm">✓ Settings saved successfully</span>}
          </div>
        </form>
      )}
    </div>
  );
}
