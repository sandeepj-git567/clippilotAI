'use client';

import { useEffect, useState } from 'react';
import {
  getClips,
  approveClip,
  rejectClip,
  scheduleClip,
  publishClip,
  deleteClip,
  updateClipMetadata,
  getPresets,
  renderClipWithPreset
} from '@/lib/api';

interface Preset {
  id: string;
  name: string;
  format: string;
}

interface Clip {
  id: string;
  title: string;
  description: string;
  hashtags: string[];
  status: string;
  durationSec?: number;
  qualityScore?: number;
  outputFilePath?: string;
  thumbnailPath?: string;
  editingFormat?: string;
  presetId?: string;
  sourceVideo?: { title: string };
  highlight?: { hook?: string; transcriptText?: string; overallScore?: number };
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  GENERATED: 'bg-blue-900 text-blue-200',
  APPROVED: 'bg-green-900 text-green-200',
  REJECTED: 'bg-red-900 text-red-200',
  SCHEDULED: 'bg-yellow-900 text-yellow-200',
  UPLOADING: 'bg-indigo-900 text-indigo-200',
  PUBLISHED: 'bg-emerald-800 text-emerald-200',
  FAILED: 'bg-red-900 text-red-200',
};

export default function ClipsPage() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Modal State
  const [editingClip, setEditingClip] = useState<Clip | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState('');

  // Schedule Modal State
  const [schedulingClip, setSchedulingClip] = useState<Clip | null>(null);
  const [scheduledDate, setScheduledDate] = useState('');

  // Preview Modal State
  const [previewClip, setPreviewClip] = useState<Clip | null>(null);

  // Presets and Re-render State
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [reRendering, setReRendering] = useState(false);

  const load = () => {
    setLoading(true);
    getClips()
      .then((d) => setClips(Array.isArray(d) ? d : d?.clips ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    getPresets()
      .then((d) => {
        const list: Preset[] = Array.isArray(d) ? d : d?.presets ?? [];
        setPresets(list);
        if (list.length > 0 && !selectedPresetId) {
          setSelectedPresetId(list[0].id);
        }
      })
      .catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const handleReRenderWithPreset = async (clipId: string) => {
    if (!selectedPresetId) {
      alert('Please select an editing preset');
      return;
    }
    setReRendering(true);
    try {
      await renderClipWithPreset(clipId, { presetId: selectedPresetId });
      alert('Clip successfully re-rendered with new preset!');
      setPreviewClip(null);
      load();
    } catch (err: any) {
      alert(err.message || 'Failed to re-render clip');
    } finally {
      setReRendering(false);
    }
  };

  const handleApprove = async (id: string) => {
    try { await approveClip(id); load(); } catch (e: any) { alert(e.message); }
  };

  const handleReject = async (id: string) => {
    try { await rejectClip(id); load(); } catch (e: any) { alert(e.message); }
  };

  const handlePublish = async (id: string) => {
    if (!confirm('Publish this clip immediately to YouTube Shorts?')) return;
    try { await publishClip(id); load(); } catch (e: any) { alert(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this clip and its rendered video?')) return;
    try { await deleteClip(id); load(); } catch (e: any) { alert(e.message); }
  };

  const openEdit = (clip: Clip) => {
    setEditingClip(clip);
    setTitle(clip.title);
    setDescription(clip.description);
    setHashtags(clip.hashtags?.join(', ') || '');
  };

  const saveEdit = async () => {
    if (!editingClip) return;
    try {
      await updateClipMetadata(editingClip.id, {
        title,
        description,
        hashtags: hashtags.split(',').map((s) => s.trim()).filter(Boolean),
      });
      setEditingClip(null);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const openSchedule = (clip: Clip) => {
    setSchedulingClip(clip);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(18, 0, 0, 0);
    setScheduledDate(tomorrow.toISOString().slice(0, 16));
  };

  const saveSchedule = async () => {
    if (!schedulingClip) return;
    try {
      await scheduleClip(schedulingClip.id);
      setSchedulingClip(null);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Clip Library</h2>
          <p className="text-gray-400 mt-1">Review, play, approve, and publish AI-extracted 9:16 vertical Shorts</p>
        </div>
        <button onClick={load} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm">
          🔄 Refresh
        </button>
      </div>

      {loading && <div className="text-gray-400 text-center py-16">Loading clips...</div>}
      {error && <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg p-4 mb-4">{error}</div>}

      {!loading && !error && clips.length === 0 && (
        <div className="bg-gray-800 rounded-xl p-12 text-center">
          <p className="text-4xl mb-4">✂️</p>
          <h3 className="text-white font-semibold mb-2">No clips generated yet</h3>
          <p className="text-gray-400 mb-4">Submit a video or process an existing video from the Library.</p>
        </div>
      )}

      {!loading && clips.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clips.map((clip) => {
            const previewUrl = `/api/clips/${clip.id}/preview`;
            const thumbUrl = `/api/clips/${clip.id}/thumbnail`;

            return (
              <div key={clip.id} className="bg-gray-800 rounded-xl overflow-hidden border border-gray-750 flex flex-col shadow-lg">
                {/* Embedded Vertical Video Player */}
                <div className="relative bg-black aspect-[9/16] max-h-[380px] flex items-center justify-center overflow-hidden group">
                  <video
                    controls
                    playsInline
                    preload="metadata"
                    poster={thumbUrl}
                    src={previewUrl}
                    className="w-full h-full object-contain"
                  />
                  <button
                    onClick={() => setPreviewClip(clip)}
                    className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    🔍 Inspect
                  </button>
                  <span className="absolute bottom-2 left-2 bg-black/70 text-white text-[11px] px-2 py-0.5 rounded font-mono">
                    {clip.durationSec ? `${Math.round(clip.durationSec)}s` : '15s'} • {clip.editingFormat || '9:16'}
                  </span>
                </div>

                <div className="p-4 flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[clip.status] ?? 'bg-gray-700'}`}>
                      {clip.status}
                    </span>
                    {clip.qualityScore !== undefined && (
                      <span className="text-xs bg-yellow-900/60 text-yellow-300 px-2 py-0.5 rounded font-semibold">
                        ⭐ {clip.qualityScore} pts
                      </span>
                    )}
                  </div>
                  <h3 className="text-white font-semibold line-clamp-2 mb-1 text-sm">{clip.title}</h3>
                  <p className="text-xs text-gray-400 mb-2">From: {clip.sourceVideo?.title || 'Source Video'}</p>
                  <p className="text-xs text-gray-300 line-clamp-2 mb-3">{clip.description}</p>
                  {clip.hashtags && clip.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {clip.hashtags.slice(0, 4).map((tag, i) => (
                        <span key={i} className="text-xs text-blue-400">{tag.startsWith('#') ? tag : `#${tag}`}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-3 bg-gray-900 border-t border-gray-750 flex flex-wrap gap-2 text-xs">
                  {clip.status === 'GENERATED' && (
                    <>
                      <button onClick={() => handleApprove(clip.id)} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded font-medium">
                        ✓ Approve
                      </button>
                      <button onClick={() => handleReject(clip.id)} className="bg-red-800 hover:bg-red-700 text-white px-3 py-1.5 rounded">
                        Reject
                      </button>
                    </>
                  )}
                  {clip.status === 'APPROVED' && (
                    <>
                      <button onClick={() => handlePublish(clip.id)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded font-medium">
                        Publish
                      </button>
                      <button onClick={() => openSchedule(clip)} className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded">
                        Schedule
                      </button>
                    </>
                  )}
                  <button onClick={() => openEdit(clip)} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(clip.id)} className="text-red-400 hover:text-red-300 px-2 py-1.5 ml-auto">
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Inspect Modal */}
      {previewClip && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-2xl w-full border border-gray-700 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white line-clamp-1">{previewClip.title}</h3>
              <button onClick={() => setPreviewClip(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>
            <div className="flex flex-col md:flex-row gap-6 items-center mb-6">
              <div className="w-full md:w-1/2 aspect-[9/16] bg-black rounded-lg overflow-hidden flex items-center justify-center">
                <video
                  controls
                  autoPlay
                  playsInline
                  src={`/api/clips/${previewClip.id}/preview`}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="w-full md:w-1/2 space-y-3 text-sm">
                <div>
                  <span className="text-xs text-gray-400 uppercase tracking-wide block">Status</span>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold mt-1 ${STATUS_COLORS[previewClip.status] ?? 'bg-gray-700'}`}>
                    {previewClip.status}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 uppercase tracking-wide block">Quality Score</span>
                  <p className="text-white font-medium text-sm mt-0.5">⭐ {previewClip.qualityScore ?? 100} / 100 pts</p>
                </div>
                <div>
                  <span className="text-xs text-gray-400 uppercase tracking-wide block">Format</span>
                  <p className="text-white text-sm mt-0.5">{previewClip.editingFormat || 'SPLIT_SCREEN'} (1080x1920)</p>
                </div>
                <div>
                  <span className="text-xs text-gray-400 uppercase tracking-wide block">Duration</span>
                  <p className="text-white text-sm mt-0.5">{previewClip.durationSec ? `${Math.round(previewClip.durationSec)} seconds` : '—'}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-400 uppercase tracking-wide block">Description</span>
                  <p className="text-gray-300 text-xs mt-0.5">{previewClip.description}</p>
                </div>

                {/* Preset Switcher & Re-render */}
                <div className="pt-3 border-t border-gray-750">
                  <span className="text-xs text-blue-400 font-semibold block mb-1.5">Change Preset & Re-render</span>
                  <div className="flex flex-col gap-2">
                    <select
                      value={selectedPresetId}
                      onChange={(e) => setSelectedPresetId(e.target.value)}
                      className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      {presets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.format.replace('_', ' ')})
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => handleReRenderWithPreset(previewClip.id)}
                      disabled={reRendering}
                      className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-lg transition shadow flex items-center justify-center gap-1.5"
                    >
                      {reRendering ? (
                        <>
                          <span className="animate-spin">⏳</span> Re-rendering Video...
                        </>
                      ) : (
                        <>
                          <span>⚡</span> Re-render Clip with Preset
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setPreviewClip(null)} className="px-4 py-2 bg-gray-700 text-white rounded text-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Clip Modal */}
      {editingClip && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-lg w-full border border-gray-700">
            <h3 className="text-lg font-bold text-white mb-4">Edit Clip Metadata</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Hashtags (comma separated)</label>
                <input
                  type="text"
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setEditingClip(null)} className="px-4 py-2 bg-gray-700 text-white rounded text-sm">
                Cancel
              </button>
              <button onClick={saveEdit} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Clip Modal */}
      {schedulingClip && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full border border-gray-700">
            <h3 className="text-lg font-bold text-white mb-4">Schedule for Publishing</h3>
            <p className="text-xs text-gray-300 mb-4">
              Choose target publication time for <strong className="text-white">{schedulingClip.title}</strong>
            </p>
            <div className="mb-4">
              <label className="text-xs text-gray-400 block mb-1">Target Date & Time</label>
              <input
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setSchedulingClip(null)} className="px-4 py-2 bg-gray-700 text-white rounded text-sm">
                Cancel
              </button>
              <button onClick={saveSchedule} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm font-medium">
                Confirm Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
