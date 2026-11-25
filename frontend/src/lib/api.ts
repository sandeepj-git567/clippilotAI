import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 60000,
});

// Request interceptor: attach auth token from localStorage
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor: handle 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
    return Promise.reject(err);
  }
);

export default api;

// --- Videos ---
export const getVideos = () => api.get('/api/videos').then((r) => r.data);
export const getVideoById = (id: string) => api.get(`/api/videos/${id}`).then((r) => r.data);
export const getYouTubeInfo = (url: string) =>
  api.get('/api/videos/youtube-info', { params: { url } }).then((r) => r.data);
export const submitVideo = (formData: FormData, onProgress?: (pct: number) => void) =>
  api.post('/api/videos/submit', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 0, // No timeout for large media uploads
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
    },
  }).then((r) => r.data);
export const deleteVideo = (id: string) => api.delete(`/api/videos/${id}`).then((r) => r.data);
export const analyzeVideo = (id: string) => api.post(`/api/videos/${id}/analyze`).then((r) => r.data);

// --- Jobs ---
export const getJobs = () => api.get('/api/jobs').then((r) => r.data);
export const getJobById = (id: string) => api.get(`/api/jobs/${id}`).then((r) => r.data);
export const cancelJob = (id: string) => api.post(`/api/jobs/${id}/cancel`).then((r) => r.data);

// --- Highlights ---
export const getHighlights = (videoId: string) =>
  api.get(`/api/highlights/${videoId}`).then((r) => r.data);

// --- Clips ---
export const getClips = () => api.get('/api/clips').then((r) => r.data);
export const getClipById = (id: string) => api.get(`/api/clips/${id}`).then((r) => r.data);
export const approveClip = (id: string) => api.post(`/api/clips/${id}/approve`).then((r) => r.data);
export const rejectClip = (id: string) => api.post(`/api/clips/${id}/reject`).then((r) => r.data);
export const scheduleClip = (id: string) => api.post(`/api/clips/${id}/schedule`).then((r) => r.data);
export const publishClip = (id: string) => api.post(`/api/clips/${id}/publish`).then((r) => r.data);
export const deleteClip = (id: string) => api.delete(`/api/clips/${id}`).then((r) => r.data);
export const renderClipWithPreset = (id: string, data?: { presetId?: string; backgroundMediaId?: string; editingFormat?: string; burnSubtitles?: boolean }) =>
  api.post(`/api/clips/${id}/render`, data || {}).then((r) => r.data);
export const updateClipMetadata = (id: string, data: { title?: string; description?: string; hashtags?: string[] }) =>
  api.patch(`/api/clips/${id}/metadata`, data).then((r) => r.data);

// --- YouTube ---
export const getYouTubeStatus = () => api.get('/api/youtube/status').then((r) => r.data);
export const connectYouTube = () => api.get('/api/youtube/connect').then((r) => r.data);
export const disconnectYouTube = (accountId: string) =>
  api.post('/api/youtube/disconnect', { accountId }).then((r) => r.data);

// --- Publishing ---
export const getPublishing = () => api.get('/api/publishing').then((r) => r.data);
export const getPublished = () => api.get('/api/publishing/published').then((r) => r.data);

// --- Analytics ---
export const getAnalytics = () => api.get('/api/analytics').then((r) => r.data);

// --- Settings ---
export const getSettings = () => api.get('/api/settings').then((r) => r.data);
export const updateSettings = (data: Record<string, unknown>) =>
  api.patch('/api/settings', data).then((r) => r.data);

// --- Background Media ---
export const getBackgroundMedia = () => api.get('/api/background-media').then((r) => r.data);
export const deleteBackgroundMedia = (id: string) =>
  api.delete(`/api/background-media/${id}`).then((r) => r.data);
export const setDefaultBackgroundMedia = (id: string) =>
  api.post(`/api/background-media/${id}/set-default`).then((r) => r.data);
export const updateBackgroundMedia = (id: string, data: { title?: string; description?: string; category?: string; isActive?: boolean; isLoopable?: boolean; isDefault?: boolean }) =>
  api.patch(`/api/background-media/${id}`, data).then((r) => r.data);
export const uploadBackgroundMedia = (formData: FormData) =>
  api.post('/api/background-media', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);

// --- Presets ---
export const getPresets = () => api.get('/api/presets').then((r) => r.data);
export const createPreset = (data: Record<string, any>) => api.post('/api/presets', data).then((r) => r.data);
export const updatePreset = (id: string, data: Record<string, any>) => api.patch(`/api/presets/${id}`, data).then((r) => r.data);
export const deletePreset = (id: string) => api.delete(`/api/presets/${id}`).then((r) => r.data);
export const duplicatePreset = (id: string) => api.post(`/api/presets/${id}/duplicate`).then((r) => r.data);
export const setDefaultPreset = (id: string) => api.post(`/api/presets/${id}/set-default`).then((r) => r.data);

// --- Health ---
export const getHealth = () => api.get('/api/health').then((r) => r.data);

// --- Auth ---
export const getGoogleAuthUrl = () => api.get('/api/auth/google/url').then((r) => r.data);
export const loginWithGoogleCredential = (credential: string) =>
  api.post('/api/auth/google/verify', { credential }).then((r) => r.data);
export const login = (data: { email: string; password: string }) =>
  api.post('/api/auth/login', data).then((r) => r.data);
export const register = (data: { email: string; password: string; name?: string }) =>
  api.post('/api/auth/register', data).then((r) => r.data);
export const getMe = () => api.get('/api/auth/me').then((r) => r.data);

