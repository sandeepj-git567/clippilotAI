'use client';

import { useEffect, useState } from 'react';
import {
  getPresets,
  createPreset,
  updatePreset,
  deletePreset,
  duplicatePreset,
  setDefaultPreset
} from '@/lib/api';

interface Preset {
  id: string;
  name: string;
  description?: string;
  format: 'SPLIT_SCREEN' | 'FULL_SCREEN' | 'FACECAM';
  splitRatio: number;
  captionPreset: string;
  fontName: string;
  fontSize: number;
  primaryColor: string;
  highlightColor: string;
  outlineColor: string;
  outlineWidth: number;
  position: string;
  animationType: string;
  audioNormalization: boolean;
  isDefault: boolean;
  facecamPosition?: string;
  facecamSize?: string;
  facecamBorderWidth?: number;
  facecamBorderColor?: string;
  facecamCornerRadius?: number;
  subtleZoom?: boolean;
  cropMode?: string;
  maxWordsPerLine?: number;
  createdAt: string;
}

const FONTS = ['Montserrat', 'Arial', 'Impact', 'Roboto', 'Oswald', 'Poppins'];
const ANIMATIONS = [
  { value: 'word_highlight', label: 'Word-by-Word Highlight (High Retention)' },
  { value: 'pop', label: 'Bouncing Pop Captions' },
  { value: 'clean', label: 'Clean Subtitles (Minimal Editorial)' }
];
const FACECAM_POSITIONS = [
  { value: 'top_right', label: 'Top Right' },
  { value: 'top_left', label: 'Top Left' },
  { value: 'bottom_right', label: 'Bottom Right' },
  { value: 'bottom_left', label: 'Bottom Left' }
];
const FACECAM_SIZES = [
  { value: 'small', label: 'Small (25% width)' },
  { value: 'medium', label: 'Medium (32% width)' },
  { value: 'large', label: 'Large (40% width)' }
];

export default function PresetsPage() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState<'SPLIT_SCREEN' | 'FULL_SCREEN' | 'FACECAM'>('SPLIT_SCREEN');
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [captionPreset, setCaptionPreset] = useState('Dynamic Captions');
  const [fontName, setFontName] = useState('Montserrat');
  const [fontSize, setFontSize] = useState(64);
  const [primaryColor, setPrimaryColor] = useState('&H00FFFFFF');
  const [highlightColor, setHighlightColor] = useState('&H0000FFFF');
  const [outlineWidth, setOutlineWidth] = useState(3.5);
  const [position, setPosition] = useState('center');
  const [animationType, setAnimationType] = useState('word_highlight');
  const [isDefault, setIsDefault] = useState(false);
  const [audioNormalization, setAudioNormalization] = useState(true);

  // Facecam & Effects
  const [facecamPosition, setFacecamPosition] = useState('top_right');
  const [facecamSize, setFacecamSize] = useState('medium');
  const [facecamBorderWidth, setFacecamBorderWidth] = useState(4.0);
  const [facecamBorderColor, setFacecamBorderColor] = useState('#3B82F6');
  const [subtleZoom, setSubtleZoom] = useState(false);
  const [cropMode, setCropMode] = useState('smart');

  // Preview Drawer/Modal
  const [previewPreset, setPreviewPreset] = useState<Preset | null>(null);

  const load = () => {
    setLoading(true);
    getPresets()
      .then((d) => setPresets(Array.isArray(d) ? d : d?.presets ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const openCreateModal = () => {
    setIsEditing(false);
    setCurrentId(null);
    setName('');
    setDescription('');
    setFormat('SPLIT_SCREEN');
    setSplitRatio(0.5);
    setCaptionPreset('Dynamic Captions');
    setFontName('Montserrat');
    setFontSize(64);
    setPrimaryColor('&H00FFFFFF');
    setHighlightColor('&H0000FFFF');
    setOutlineWidth(3.5);
    setPosition('center');
    setAnimationType('word_highlight');
    setIsDefault(false);
    setAudioNormalization(true);
    setFacecamPosition('top_right');
    setFacecamSize('medium');
    setFacecamBorderWidth(4.0);
    setFacecamBorderColor('#3B82F6');
    setSubtleZoom(false);
    setCropMode('smart');
    setModalOpen(true);
  };

  const openEditModal = (p: Preset) => {
    setIsEditing(true);
    setCurrentId(p.id);
    setName(p.name);
    setDescription(p.description || '');
    setFormat(p.format);
    setSplitRatio(p.splitRatio ?? 0.5);
    setCaptionPreset(p.captionPreset || 'Dynamic Captions');
    setFontName(p.fontName || 'Montserrat');
    setFontSize(p.fontSize || 64);
    setPrimaryColor(p.primaryColor || '&H00FFFFFF');
    setHighlightColor(p.highlightColor || '&H0000FFFF');
    setOutlineWidth(p.outlineWidth || 3.5);
    setPosition(p.position || 'center');
    setAnimationType(p.animationType || 'word_highlight');
    setIsDefault(p.isDefault || false);
    setAudioNormalization(p.audioNormalization ?? true);
    setFacecamPosition(p.facecamPosition || 'top_right');
    setFacecamSize(p.facecamSize || 'medium');
    setFacecamBorderWidth(p.facecamBorderWidth || 4.0);
    setFacecamBorderColor(p.facecamBorderColor || '#3B82F6');
    setSubtleZoom(Boolean(p.subtleZoom));
    setCropMode(p.cropMode || 'smart');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        format,
        splitRatio,
        captionPreset,
        fontName,
        fontSize,
        primaryColor,
        highlightColor,
        outlineWidth,
        position,
        animationType,
        isDefault,
        audioNormalization,
        facecamPosition,
        facecamSize,
        facecamBorderWidth,
        facecamBorderColor,
        subtleZoom,
        cropMode
      };

      if (isEditing && currentId) {
        await updatePreset(currentId, payload);
      } else {
        await createPreset(payload);
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      alert(err.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, presetName: string) => {
    if (!confirm(`Are you sure you want to delete preset "${presetName}"?`)) return;
    try {
      await deletePreset(id);
      load();
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await duplicatePreset(id);
      load();
    } catch (err: any) {
      alert(err.message || 'Duplicate failed');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultPreset(id);
      load();
    } catch (err: any) {
      alert(err.message || 'Failed to set default');
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-6 border-b border-gray-800">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Editing Presets</h1>
          <p className="text-gray-400 mt-1.5 text-sm">
            Reusable templates determining layout (Split Screen, Full Screen, Facecam PiP), typography, and subtitle animations.
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center gap-3">
          <button
            onClick={openCreateModal}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-600/30 transition flex items-center gap-2"
          >
            <span>✨</span> Create Preset
          </button>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="bg-red-950/50 border border-red-700 text-red-200 rounded-xl p-4 mb-6">
          {error}
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div className="text-gray-400 text-center py-20 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm">Loading editing presets...</p>
        </div>
      )}

      {/* GRID */}
      {!loading && presets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6">
          {presets.map((p) => (
            <div
              key={p.id}
              className={`bg-gray-850 rounded-2xl border transition-all duration-200 p-6 flex flex-col justify-between ${
                p.isDefault ? 'border-blue-500/80 shadow-xl shadow-blue-500/10' : 'border-gray-750 hover:border-gray-650'
              }`}
            >
              <div>
                {/* BADGES */}
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold tracking-wider ${
                      p.format === 'SPLIT_SCREEN'
                        ? 'bg-purple-950 text-purple-300 border border-purple-500/30'
                        : p.format === 'FACECAM'
                        ? 'bg-amber-950 text-amber-300 border border-amber-500/30'
                        : 'bg-blue-950 text-blue-300 border border-blue-500/30'
                    }`}
                  >
                    {p.format.replace('_', ' ')}
                  </span>

                  {p.isDefault ? (
                    <span className="text-xs bg-green-950 text-green-300 font-bold px-2 py-0.5 rounded-full border border-green-500/30">
                      ★ Default
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSetDefault(p.id)}
                      className="text-xs text-gray-500 hover:text-gray-300"
                      title="Set as Default Preset"
                    >
                      Make Default
                    </button>
                  )}
                </div>

                {/* TITLE & DESCRIPTION */}
                <h3 className="text-white font-bold text-lg leading-snug">{p.name}</h3>
                <p className="text-xs text-gray-400 mt-2 line-clamp-3 leading-relaxed">
                  {p.description || 'Configured AI video rendering template.'}
                </p>

                {/* VISUAL MINI MOCKUP */}
                <div
                  onClick={() => setPreviewPreset(p)}
                  className="mt-4 mb-4 bg-black/50 border border-gray-750 rounded-xl p-3 cursor-pointer hover:border-blue-500/50 transition group flex flex-col items-center justify-center relative h-28 overflow-hidden"
                >
                  {p.format === 'SPLIT_SCREEN' && (
                    <div className="w-16 h-full flex flex-col border border-gray-700 rounded overflow-hidden">
                      <div className="flex-1 bg-blue-900/40 flex items-center justify-center text-[8px] text-blue-200">
                        Top {p.splitRatio * 100}%
                      </div>
                      <div className="flex-1 bg-gray-800 flex items-center justify-center text-[8px] text-gray-400 border-t border-gray-700">
                        Game BG
                      </div>
                    </div>
                  )}

                  {p.format === 'FULL_SCREEN' && (
                    <div className="w-16 h-full border border-gray-700 rounded bg-blue-950/40 flex flex-col items-center justify-center relative">
                      <span className="text-[9px] text-blue-300 font-bold">9:16</span>
                      <div className="absolute bottom-3 bg-yellow-400/90 text-black text-[7px] font-bold px-1 rounded">
                        WORD
                      </div>
                    </div>
                  )}

                  {p.format === 'FACECAM' && (
                    <div className="w-16 h-full border border-gray-700 rounded bg-blue-950/30 relative flex flex-col items-center justify-center">
                      <span className="text-[8px] text-gray-400">Main</span>
                      <div
                        className={`absolute w-6 h-6 rounded-md border-2 border-blue-400 bg-amber-500/40 flex items-center justify-center text-[6px] text-white font-bold ${
                          p.facecamPosition === 'top_left'
                            ? 'top-1 left-1'
                            : p.facecamPosition === 'bottom_left'
                            ? 'bottom-1 left-1'
                            : p.facecamPosition === 'bottom_right'
                            ? 'bottom-1 right-1'
                            : 'top-1 right-1'
                        }`}
                      >
                        Cam
                      </div>
                    </div>
                  )}

                  <span className="text-[10px] text-gray-400 mt-1 opacity-0 group-hover:opacity-100 transition">
                    Click to preview layout
                  </span>
                </div>

                {/* SPECS */}
                <div className="space-y-1.5 text-xs text-gray-300 bg-gray-900/70 p-3 rounded-xl border border-gray-800">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Typography:</span>
                    <span className="text-white font-medium">{p.fontName} ({p.fontSize}px)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Captions:</span>
                    <span className="text-white font-medium">{p.animationType.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Position:</span>
                    <span className="text-white font-medium capitalize">{p.position}</span>
                  </div>
                  {p.format === 'FACECAM' && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Facecam:</span>
                      <span className="text-amber-300 font-medium capitalize">{p.facecamPosition?.replace('_', ' ')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="mt-5 pt-3.5 border-t border-gray-800 flex items-center justify-between text-xs">
                <button
                  onClick={() => openEditModal(p)}
                  className="text-blue-400 hover:text-blue-300 font-semibold"
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => handleDuplicate(p.id)}
                  className="text-gray-300 hover:text-white font-medium"
                >
                  📋 Duplicate
                </button>
                <button
                  onClick={() => handleDelete(p.id, p.name)}
                  disabled={p.isDefault}
                  className="text-red-400 hover:text-red-300 font-medium disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PREVIEW MODAL */}
      {previewPreset && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-750 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold text-base">{previewPreset.name}</h3>
                <span className="text-xs text-gray-400">Format: {previewPreset.format}</span>
              </div>
              <button
                onClick={() => setPreviewPreset(null)}
                className="text-gray-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* 9:16 VERTICAL SIMULATION */}
            <div className="p-6 flex justify-center bg-gray-950">
              <div className="w-56 h-[398px] bg-gray-900 rounded-2xl border-4 border-gray-700 relative overflow-hidden flex flex-col shadow-2xl">
                {/* FORMAT VISUAL */}
                {previewPreset.format === 'SPLIT_SCREEN' && (
                  <>
                    <div
                      className="bg-blue-900/60 border-b-2 border-yellow-400/80 flex flex-col items-center justify-center text-xs text-blue-200"
                      style={{ height: `${(previewPreset.splitRatio || 0.5) * 100}%` }}
                    >
                      <span className="text-2xl mb-1">🎮</span>
                      <span>Main Video ({Math.round((previewPreset.splitRatio || 0.5) * 100)}%)</span>
                    </div>
                    <div className="flex-1 bg-gray-800 flex flex-col items-center justify-center text-xs text-gray-300">
                      <span className="text-2xl mb-1">🛹</span>
                      <span>Gameplay Background</span>
                    </div>
                  </>
                )}

                {previewPreset.format === 'FULL_SCREEN' && (
                  <div className="flex-1 bg-gradient-to-b from-blue-950/80 to-purple-950/80 flex flex-col items-center justify-center text-xs text-blue-200">
                    <span className="text-4xl mb-2">📹</span>
                    <span className="font-semibold">Full Screen 9:16</span>
                    <span className="text-[10px] text-gray-400">Smart Crop + Reframing</span>
                  </div>
                )}

                {previewPreset.format === 'FACECAM' && (
                  <div className="flex-1 bg-blue-950/70 relative flex flex-col items-center justify-center text-xs text-blue-200">
                    <span className="text-4xl mb-2">🎮</span>
                    <span>Main Gameplay</span>

                    {/* FACECAM OVERLAY */}
                    <div
                      className={`absolute w-20 h-20 rounded-xl border-2 border-blue-400 bg-amber-600/90 shadow-xl flex flex-col items-center justify-center text-[10px] text-white font-bold ${
                        previewPreset.facecamPosition === 'top_left'
                          ? 'top-3 left-3'
                          : previewPreset.facecamPosition === 'bottom_left'
                          ? 'bottom-16 left-3'
                          : previewPreset.facecamPosition === 'bottom_right'
                          ? 'bottom-16 right-3'
                          : 'top-3 right-3'
                      }`}
                    >
                      <span>👤</span>
                      <span>Facecam</span>
                    </div>
                  </div>
                )}

                {/* BURNED SUBTITLES SIMULATION */}
                <div
                  className={`absolute inset-x-2 flex flex-col items-center text-center px-2 pointer-events-none ${
                    previewPreset.position === 'top'
                      ? 'top-10'
                      : previewPreset.position === 'bottom'
                      ? 'bottom-6'
                      : 'top-1/2 -translate-y-1/2'
                  }`}
                >
                  <div className="bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-lg">
                    <span className="text-white text-xs font-black uppercase tracking-wide">
                      LOOK AT THIS{' '}
                    </span>
                    <span className="text-yellow-400 text-xs font-black uppercase tracking-wide scale-110 inline-block drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                      INSANE
                    </span>
                    <span className="text-white text-xs font-black uppercase tracking-wide">
                      {' '}MOMENT!
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-900 border-t border-gray-800 flex justify-end">
              <button
                onClick={() => setPreviewPreset(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-semibold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-750 rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-6">
              <h3 className="text-white font-bold text-xl">
                {isEditing ? `Edit Preset: ${name}` : 'Create New Editing Preset'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-white text-xl p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* SECTION 1: IDENTITY */}
              <div>
                <h4 className="text-xs uppercase font-bold tracking-wider text-blue-400 mb-3">
                  1. Preset Identity & Format
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1.5">Preset Name</label>
                    <input
                      type="text"
                      placeholder="e.g. High-Retention Gaming Short"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1.5">Editing Format</label>
                    <select
                      value={format}
                      onChange={(e) => setFormat(e.target.value as any)}
                      className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="SPLIT_SCREEN">Split Screen (Top Source + Bottom Gameplay)</option>
                      <option value="FULL_SCREEN">Full Screen 9:16 (Smart Crop & Reframe)</option>
                      <option value="FACECAM">Facecam Picture-in-Picture (Smart Facecam Detection)</option>
                    </select>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="text-xs font-semibold text-gray-300 block mb-1.5">Description</label>
                  <input
                    type="text"
                    placeholder="Short summary of this preset's design purpose"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* SECTION 2: FORMAT SPECIFIC CONFIG */}
              {format === 'SPLIT_SCREEN' && (
                <div className="bg-gray-950 p-4 rounded-xl border border-gray-800">
                  <h4 className="text-xs uppercase font-bold tracking-wider text-purple-400 mb-2">
                    Split-Screen Settings
                  </h4>
                  <div className="flex items-center justify-between text-xs text-gray-300 mb-2">
                    <span>Upper (Main) Video Ratio: {Math.round(splitRatio * 100)}%</span>
                    <span>Lower (Background) Ratio: {Math.round((1 - splitRatio) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.3"
                    max="0.7"
                    step="0.05"
                    value={splitRatio}
                    onChange={(e) => setSplitRatio(parseFloat(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>
              )}

              {format === 'FACECAM' && (
                <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 space-y-3">
                  <h4 className="text-xs uppercase font-bold tracking-wider text-amber-400 mb-1">
                    Streamer Facecam Overlay Settings
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-300 block mb-1.5">Facecam Position</label>
                      <select
                        value={facecamPosition}
                        onChange={(e) => setFacecamPosition(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white text-xs"
                      >
                        {FACECAM_POSITIONS.map((fp) => (
                          <option key={fp.value} value={fp.value}>
                            {fp.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-300 block mb-1.5">Facecam Overlay Size</label>
                      <select
                        value={facecamSize}
                        onChange={(e) => setFacecamSize(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white text-xs"
                      >
                        {FACECAM_SIZES.map((fs) => (
                          <option key={fs.value} value={fs.value}>
                            {fs.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 3: TYPOGRAPHY & CAPTIONS */}
              <div>
                <h4 className="text-xs uppercase font-bold tracking-wider text-green-400 mb-3">
                  2. Caption Styling & Animations
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1.5">Font Family</label>
                    <select
                      value={fontName}
                      onChange={(e) => setFontName(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3.5 py-2 text-white text-sm"
                    >
                      {FONTS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1.5">Font Size (px)</label>
                    <input
                      type="number"
                      min={40}
                      max={96}
                      value={fontSize}
                      onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                      className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3.5 py-2 text-white text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1.5">Vertical Placement</label>
                    <select
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3.5 py-2 text-white text-sm"
                    >
                      <option value="center">Center</option>
                      <option value="bottom">Bottom (Safe Area)</option>
                      <option value="top">Top</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1.5">Animation Style</label>
                    <select
                      value={animationType}
                      onChange={(e) => setAnimationType(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3.5 py-2 text-white text-sm"
                    >
                      {ANIMATIONS.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1.5">Highlight Color</label>
                    <select
                      value={highlightColor}
                      onChange={(e) => setHighlightColor(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3.5 py-2 text-white text-sm"
                    >
                      <option value="&H0000FFFF">Vibrant Yellow (&H0000FFFF)</option>
                      <option value="&H0000FF00">Neon Green (&H0000FF00)</option>
                      <option value="&H00FFFF00">Cyan Blue (&H00FFFF00)</option>
                      <option value="&H00FF00FF">Magenta Pink (&H00FF00FF)</option>
                      <option value="&H00FFFFFF">Solid White (&H00FFFFFF)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 4: TOGGLES */}
              <div className="pt-2 flex flex-col gap-2.5">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="rounded border-gray-700 text-blue-600 focus:ring-0 accent-blue-600"
                  />
                  Set as Default Preset for new video processing jobs
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                  <input
                    type="checkbox"
                    checked={audioNormalization}
                    onChange={(e) => setAudioNormalization(e.target.checked)}
                    className="rounded border-gray-700 text-blue-600 focus:ring-0 accent-blue-600"
                  />
                  Enable EBU R128 Audio Normalization (Loudnorm)
                </label>
              </div>

              {/* FOOTER */}
              <div className="pt-5 border-t border-gray-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-600/30 disabled:opacity-50"
                >
                  {submitting ? 'Saving Preset...' : isEditing ? 'Update Preset' : 'Create Preset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
