'use client';

import { useEffect, useState, useRef } from 'react';
import {
  getBackgroundMedia,
  uploadBackgroundMedia,
  deleteBackgroundMedia,
  updateBackgroundMedia,
  setDefaultBackgroundMedia
} from '@/lib/api';

interface MediaItem {
  id: string;
  title: string;
  description?: string;
  category: string;
  filePath: string;
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  fileSize: string;
  isActive: boolean;
  isLoopable: boolean;
  isDefault: boolean;
  previewUrl: string;
  thumbnailUrl: string;
  createdAt: string;
}

const CATEGORIES = [
  'Gaming',
  'Minecraft',
  'GTA',
  'Subway Surfers',
  'Satisfying videos',
  'Abstract backgrounds',
  'Other'
];

export default function BackgroundsPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Upload Form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Gaming');
  const [isLoopable, setIsLoopable] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Preview Modal
  const [previewMedia, setPreviewMedia] = useState<MediaItem | null>(null);

  // Edit Modal
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editIsLoopable, setEditIsLoopable] = useState(true);
  const [editIsDefault, setEditIsDefault] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    getBackgroundMedia()
      .then((d) => setItems(Array.isArray(d) ? d : d?.media ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;

    const fd = new FormData();
    fd.append('mediaFile', file);
    fd.append('title', title.trim());
    if (description.trim()) fd.append('description', description.trim());
    fd.append('category', category);
    fd.append('isLoopable', String(isLoopable));

    setUploading(true);
    try {
      await uploadBackgroundMedia(fd);
      setTitle('');
      setDescription('');
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      load();
    } catch (err: any) {
      alert(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, mediaTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${mediaTitle}"? This cannot be undone.`)) return;
    try {
      await deleteBackgroundMedia(id);
      load();
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    }
  };

  const handleToggleActive = async (item: MediaItem) => {
    try {
      await updateBackgroundMedia(item.id, { isActive: !item.isActive });
      load();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleSetDefault = async (item: MediaItem) => {
    try {
      await setDefaultBackgroundMedia(item.id);
      load();
    } catch (err: any) {
      alert(err.message || 'Failed to set as default');
    }
  };

  const handleOpenEdit = (item: MediaItem) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditDescription(item.description || '');
    setEditCategory(item.category);
    setEditIsActive(item.isActive);
    setEditIsLoopable(item.isLoopable);
    setEditIsDefault(item.isDefault || false);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setSavingEdit(true);
    try {
      await updateBackgroundMedia(editingItem.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        category: editCategory,
        isActive: editIsActive,
        isLoopable: editIsLoopable,
        isDefault: editIsDefault
      });
      setEditingItem(null);
      load();
    } catch (err: any) {
      alert(err.message || 'Failed to update media');
    } finally {
      setSavingEdit(false);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const formatFileSize = (bytesStr?: string) => {
    if (!bytesStr) return 'Unknown';
    const bytes = Number(bytesStr);
    if (isNaN(bytes) || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-6 border-b border-gray-800">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Background Media</h1>
          <p className="text-gray-400 mt-1.5 text-sm">
            Secondary gameplay, satisfying clips, and scenery loops used for split-screen vertical Shorts.
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center gap-3">
          <button
            onClick={load}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-sm font-medium border border-gray-700 transition"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* UPLOAD FORM */}
      <div className="bg-gradient-to-br from-gray-850 to-gray-900 rounded-2xl p-6 border border-gray-750 shadow-xl mb-10">
        <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
          <span>📤</span> Upload New Background Clip
        </h2>
        <p className="text-xs text-gray-400 mb-6">
          Upload 1080p or 4K landscape/vertical MP4, WebM, or MOV video footage (up to 1 GB).
        </p>

        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                Media Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. GTA 5 Rampage or Subway Surfers 60FPS"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                Media File (Video or Image) <span className="text-red-400">*</span>
              </label>
              <input
                type="file"
                ref={fileRef}
                accept="video/mp4,video/webm,video/quicktime,video/x-matroska,image/jpeg,image/png,image/webp,.mp4,.webm,.mov,.mkv,.avi,.jpg,.jpeg,.png,.webp"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setFile(f);
                  if (f && !title) {
                    setTitle(f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
                  }
                }}
                className="w-full text-xs text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-blue-600 file:text-white file:font-semibold hover:file:bg-blue-500 cursor-pointer"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-gray-300 block mb-1.5">Description (optional)</label>
              <input
                type="text"
                placeholder="Notes on source footage, gameplay mechanics, or visual style"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div className="flex items-center justify-between pt-5">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={isLoopable}
                  onChange={(e) => setIsLoopable(e.target.checked)}
                  className="rounded border-gray-700 text-blue-600 focus:ring-0 accent-blue-600"
                />
                Seamless Loop Enabled
              </label>

              <button
                type="submit"
                disabled={uploading || !file || !title.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-blue-600/30 transition flex items-center gap-2"
              >
                {uploading ? (
                  <>
                    <span className="animate-spin text-sm">⏳</span> Uploading...
                  </>
                ) : (
                  <>
                    <span>🚀</span> Upload Media
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div className="bg-red-950/50 border border-red-700/80 text-red-200 rounded-xl p-4 mb-8 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={load} className="underline text-sm ml-4">
            Retry
          </button>
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div className="text-gray-400 text-center py-20 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm">Loading background media library...</p>
        </div>
      )}

      {/* EMPTY STATE */}
      {!loading && !error && items.length === 0 && (
        <div className="bg-gray-850 rounded-2xl p-16 text-center border border-gray-750 shadow-inner">
          <p className="text-5xl mb-4">🎮</p>
          <h3 className="text-white text-lg font-bold mb-2">No background media available</h3>
          <p className="text-gray-400 text-sm max-w-md mx-auto mb-6">
            Upload gaming clips (Minecraft, GTA, Subway Surfers) or satisfying visuals above to use in Split-Screen Shorts.
          </p>
        </div>
      )}

      {/* MEDIA GRID */}
      {!loading && items.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold text-lg">
              Library Items <span className="text-gray-400 text-sm font-normal">({items.length} clips)</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <div
                key={item.id}
                className={`bg-gray-850 rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                  item.isActive ? 'border-gray-750 hover:border-gray-600 shadow-md' : 'border-gray-800 opacity-60'
                }`}
              >
                {/* THUMBNAIL / PREVIEW COVER */}
                <div className="relative aspect-video bg-black group overflow-hidden">
                  <img
                    src={item.thumbnailUrl}
                    alt={item.title}
                    className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                    onError={(e) => {
                      // Fallback gradient if thumbnail image is not available yet
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />

                  {/* Badges */}
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                    <span className="bg-black/70 backdrop-blur-md text-white text-xs px-2.5 py-1 rounded-full font-medium border border-white/10">
                      {item.category}
                    </span>
                    {item.isDefault && (
                      <span className="bg-yellow-500 text-black text-xs px-2.5 py-0.5 rounded-full font-bold shadow-sm">
                        ★ Default
                      </span>
                    )}
                    {item.isLoopable && (
                      <span className="bg-blue-900/80 backdrop-blur-md text-blue-200 text-xs px-2 py-0.5 rounded-full border border-blue-400/20">
                        🔁 Loop
                      </span>
                    )}
                  </div>

                  <div className="absolute top-3 right-3 flex items-center gap-2">
                    {!item.isDefault && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetDefault(item);
                        }}
                        className="bg-black/70 hover:bg-black text-xs text-blue-300 hover:text-white px-2 py-0.5 rounded-full backdrop-blur-md border border-white/10 transition"
                        title="Set as Default Split-Screen Background"
                      >
                        Make Default
                      </button>
                    )}
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-semibold backdrop-blur-md border ${
                        item.isActive
                          ? 'bg-green-950/80 text-green-300 border-green-500/30'
                          : 'bg-red-950/80 text-red-300 border-red-500/30'
                      }`}
                    >
                      {item.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </div>

                  {/* Play Button Overlay */}
                  <button
                    onClick={() => setPreviewMedia(item)}
                    className="absolute inset-0 m-auto w-12 h-12 bg-blue-600/90 hover:bg-blue-500 text-white rounded-full flex items-center justify-center opacity-90 group-hover:opacity-100 transition shadow-lg backdrop-blur-sm"
                    title="Play Preview"
                  >
                    ▶
                  </button>

                  {/* Duration overlay */}
                  <div className="absolute bottom-2.5 right-2.5 bg-black/80 text-white text-xs px-2 py-0.5 rounded font-mono font-medium">
                    {formatDuration(item.durationSec)}
                  </div>
                </div>

                {/* DETAILS */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="text-white font-bold text-base leading-snug line-clamp-1">{item.title}</h4>
                    {item.description && (
                      <p className="text-gray-400 text-xs mt-1 line-clamp-2">{item.description}</p>
                    )}

                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-gray-400 bg-gray-900/60 p-2.5 rounded-xl border border-gray-800">
                      <div>
                        Resolution: <span className="text-gray-200 font-medium">{item.width}x{item.height}</span>
                      </div>
                      <div>
                        Size: <span className="text-gray-200 font-medium">{formatFileSize(item.fileSize)}</span>
                      </div>
                      <div>
                        FPS: <span className="text-gray-200 font-medium">{item.fps || 30}</span>
                      </div>
                      <div>
                        Duration: <span className="text-gray-200 font-medium">{formatDuration(item.durationSec)}</span>
                      </div>
                    </div>
                  </div>

                  {/* ACTIONS */}
                  <div className="mt-5 pt-3.5 border-t border-gray-800 flex items-center justify-between text-xs">
                    <button
                      onClick={() => handleToggleActive(item)}
                      className={`font-semibold hover:underline ${
                        item.isActive ? 'text-yellow-400 hover:text-yellow-300' : 'text-green-400 hover:text-green-300'
                      }`}
                    >
                      {item.isActive ? 'Disable' : 'Enable'}
                    </button>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="text-gray-300 hover:text-white font-medium transition"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id, item.title)}
                        className="text-red-400 hover:text-red-300 font-medium transition"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIDEO PREVIEW MODAL */}
      {previewMedia && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-750 rounded-2xl overflow-hidden max-w-3xl w-full shadow-2xl">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold text-base">{previewMedia.title}</h3>
                <span className="text-xs text-gray-400">Category: {previewMedia.category}</span>
              </div>
              <button
                onClick={() => setPreviewMedia(null)}
                className="text-gray-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>
            <div className="relative aspect-video bg-black flex items-center justify-center">
              {previewMedia.filePath.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                <img
                  src={previewMedia.previewUrl}
                  alt={previewMedia.title}
                  className="w-full h-full object-contain"
                />
              ) : (
                <video
                  src={previewMedia.previewUrl}
                  controls
                  autoPlay
                  loop={previewMedia.isLoopable}
                  className="w-full h-full object-contain"
                />
              )}
            </div>
            <div className="p-4 bg-gray-950 flex items-center justify-between text-xs text-gray-400">
              <div>
                Resolution: <span className="text-white font-medium">{previewMedia.width}x{previewMedia.height}</span> | Duration: <span className="text-white font-medium">{formatDuration(previewMedia.durationSec)}</span>
              </div>
              <button
                onClick={() => setPreviewMedia(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-750 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-5">
              <h3 className="text-white font-bold text-lg">Edit Background Media</h3>
              <button
                onClick={() => setEditingItem(null)}
                className="text-gray-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5">Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5">Description</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex flex-col gap-2.5">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    className="rounded border-gray-700 text-blue-600 focus:ring-0 accent-blue-600"
                  />
                  Active (Available for Split-Screen Rendering)
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                  <input
                    type="checkbox"
                    checked={editIsDefault}
                    onChange={(e) => setEditIsDefault(e.target.checked)}
                    className="rounded border-gray-700 text-blue-600 focus:ring-0 accent-blue-600"
                  />
                  Default (Primary background selected for Split-Screen)
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                  <input
                    type="checkbox"
                    checked={editIsLoopable}
                    onChange={(e) => setEditIsLoopable(e.target.checked)}
                    className="rounded border-gray-700 text-blue-600 focus:ring-0 accent-blue-600"
                  />
                  Loopable video clip
                </label>
              </div>

              <div className="pt-4 border-t border-gray-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit || !editTitle.trim()}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-600/30 disabled:opacity-50"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
