# ClipPilot AI 🎬

ClipPilot AI is an intelligent video repurposing platform that automatically transforms long-form YouTube videos into short, engaging clips ready to publish. It uses Google Gemini AI for content analysis, Whisper for transcription, and handles the full pipeline from video submission to YouTube Shorts publication.

---

## ✨ Features

- 🎙️ **AI Transcription** – Automatic speech-to-text via OpenAI Whisper
- 🧠 **Gemini AI Analysis** – Smart highlight detection, scoring, and caption generation
- ✂️ **Clip Extraction** – FFmpeg-powered clip rendering with background media support
- 📅 **Publishing Scheduler** – Schedule clips to publish to YouTube at optimal times
- 📊 **Analytics Dashboard** – Track views, engagement, and publishing performance
- 🔑 **YouTube OAuth** – Connect multiple YouTube channels and publish directly

---

## 📋 Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| Python | 3.11+ | [python.org](https://python.org) |
| Docker Desktop | Latest | [docker.com](https://docker.com/products/docker-desktop) — recommended |
| FFmpeg | Any | Auto-installed via `winget install ffmpeg` |

**Install FFmpeg on Windows:**
```powershell
winget install ffmpeg
```

---

## 🚀 Quick Start — Docker (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/clippilot-ai.git
   cd "clippilot AI"
   ```

2. **Copy and configure environment variables**
   ```powershell
   Copy-Item .env.example .env
   # Then open .env and fill in your credentials (see Required Credentials below)
   notepad .env
   ```

3. **Start all services**
   ```powershell
   .\scripts\start-docker.ps1
   # OR manually:
   docker compose up --build -d
   ```

4. **Open the app**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - AI Engine: http://localhost:8001

5. **Default login**
   - Email: `creator@clippilot.ai`
   - Password: `clippilot123`

---

## 🖥️ Quick Start — Local (Without Docker)

1. **Install backend dependencies**
   ```powershell
   cd backend
   npm install
   npx prisma generate
   npm run build
   cd ..
   ```

2. **Install frontend dependencies**
   ```powershell
   cd frontend
   npm install
   cd ..
   ```

3. **Install AI Engine dependencies**
   ```powershell
   cd ai-engine
   pip install -r requirements.txt
   cd ..
   ```

4. **Configure environment**
   ```powershell
   Copy-Item .env.example .env
   notepad .env  # Fill in your credentials
   ```

5. **Start all services**
   ```powershell
   .\scripts\start.ps1
   ```

> **Note:** You must have PostgreSQL and Redis running locally, or use `docker compose up postgres redis -d` to run just the databases.

---

## 🔑 Required Credentials

Fill these values in your `.env` file:

### Gemini API Key
1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Click **Get API key** → **Create API key**
3. Copy the key and set `GEMINI_API_KEY=your_key_here`

### YouTube OAuth Credentials

#### Step 1 — Create a Google Cloud Project
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **New Project**, name it `ClipPilot AI`, click **Create**

#### Step 2 — Enable YouTube Data API v3
1. In the left menu, go to **APIs & Services → Library**
2. Search for **YouTube Data API v3**
3. Click **Enable**

#### Step 3 — Create OAuth 2.0 Credentials
1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth client ID**
3. Set **Application type** to **Web application**
4. Under **Authorized redirect URIs**, add:
   ```
   http://localhost:8000/api/youtube/callback
   ```
5. Click **Create**
6. Copy the **Client ID** → set `YOUTUBE_CLIENT_ID=...`
7. Copy the **Client Secret** → set `YOUTUBE_CLIENT_SECRET=...`

---

## 🎥 First Video Workflow

1. **Submit a video** — Go to http://localhost:3000/submit
2. **Fill in rights info** — Confirm you own or have rights to repurpose the video
3. **Wait for processing** — The AI engine transcribes, analyzes, and extracts highlights (~2–10 min depending on video length)
4. **Preview clips** — Browse generated clips at http://localhost:3000/clips
5. **Approve or reject** — Review each clip, edit metadata (title, description, hashtags)
6. **Schedule or publish** — Choose a publish time or publish immediately to YouTube

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        ClipPilot AI                         │
├──────────────┬──────────────────────────┬───────────────────┤
│   Frontend   │        Backend           │    AI Engine      │
│  (Next.js)   │      (Express/Node)      │    (FastAPI/Py)   │
│  :3000       │         :8000            │      :8001        │
│              │                          │                   │
│  Pages:      │  REST API + Auth         │  /api/analyze     │
│  /submit     │  YouTube OAuth           │  /api/transcribe  │
│  /clips      │  Job Queue               │  /api/render-clip │
│  /publish    │  Publishing Scheduler    │  Gemini AI        │
│  /analytics  │  Analytics              │  Whisper STT      │
│  /settings   │                          │  FFmpeg           │
└──────┬───────┴────────┬─────────────────┴───────────────────┘
       │                │
       │                ├──────────────────────────────────┐
       │                │                                  │
       ▼                ▼                                  ▼
   Browser         PostgreSQL :5432                 Redis :6379
                  (Jobs, Clips,                   (Job Queue,
                   Users, Accounts)               Session Cache)
```

---

## 🔌 Service Ports

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | Next.js web application |
| Backend | 8000 | Express REST API |
| AI Engine | 8001 | FastAPI AI processing service |
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Queue and cache |

---

## 🛠️ Troubleshooting

### FFmpeg not found
```powershell
# Install via winget
winget install ffmpeg
# Then restart your terminal or VS Code
```
If `winget` is unavailable, download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to your `PATH`.

---

### Docker permission denied
On Windows, make sure Docker Desktop is running and your user account has access.
1. Open Docker Desktop → Settings → General
2. Enable **Use WSL 2 based engine** (recommended)
3. If you get volume errors with `d:/clippilot AI/media`, ensure the drive is shared:
   - Docker Desktop → Settings → Resources → File Sharing → Add `D:\`

---

### Prisma migration failed
1. Check that `DATABASE_URL` in `.env` is correct:
   ```
   DATABASE_URL=postgresql://postgres:your_password@localhost:5432/clippilot
   ```
2. Ensure PostgreSQL is running (`pg_isready` or `docker compose ps`)
3. Run migrations manually:
   ```powershell
   cd backend
   npx prisma migrate deploy
   ```

---

### YouTube OAuth error — redirect_uri_mismatch
Make sure the redirect URI in Google Cloud Console **exactly** matches:
```
http://localhost:8000/api/youtube/callback
```
No trailing slash, no HTTPS. Save the credentials and try again.

---

### YouTube OAuth error — access_denied
Your OAuth consent screen may need to be published or your Google account added as a test user:
1. Google Cloud Console → **APIs & Services → OAuth consent screen**
2. Under **Test users**, add your Google account email
3. Try connecting again

---

## 🗂️ Project Structure

```
clippilot AI/
├── backend/           # Express + TypeScript API
│   ├── src/
│   │   ├── routes/    # REST endpoints
│   │   ├── services/  # Business logic
│   │   ├── workers/   # Background job processors
│   │   ├── middlewares/
│   │   └── db/        # Prisma client
│   ├── prisma/        # Schema and migrations
│   └── Dockerfile
├── frontend/          # Next.js 14 App Router UI
│   ├── app/           # Pages and layouts
│   ├── components/    # Shared UI components
│   └── Dockerfile
├── ai-engine/         # FastAPI Python AI service
│   ├── main.py
│   ├── services/
│   └── requirements.txt
├── scripts/
│   ├── start.ps1          # Local dev launcher
│   └── start-docker.ps1   # Docker launcher
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 📄 License

MIT © ClipPilot AI
