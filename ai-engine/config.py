import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    AI_ENGINE_HOST: str = "0.0.0.0"
    AI_ENGINE_PORT: int = 8001
    WHISPER_MODEL: str = os.getenv("WHISPER_MODEL", "base")
    WHISPER_COMPUTE_TYPE: str = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
    
    # Paths (defaults work in Docker or fall back to local relative paths)
    VIDEO_OUTPUT_DIR: str = os.getenv("VIDEO_OUTPUT_DIR", "./media/output")
    VIDEO_TEMP_DIR: str = os.getenv("VIDEO_TEMP_DIR", "./media/temp")
    VIDEO_UPLOADS_DIR: str = os.getenv("VIDEO_UPLOADS_DIR", "./media/uploads")
    BACKGROUND_MEDIA_DIR: str = os.getenv("BACKGROUND_MEDIA_DIR", "./media/backgrounds")
    
    # FFmpeg executable fallback path
    FFMPEG_PATH: str = os.getenv("FFMPEG_PATH", "ffmpeg")
    FFPROBE_PATH: str = os.getenv("FFPROBE_PATH", "ffprobe")

    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        extra="allow"
    )

settings = Settings()

# Ensure directories exist
for directory in [settings.VIDEO_OUTPUT_DIR, settings.VIDEO_TEMP_DIR, settings.VIDEO_UPLOADS_DIR, settings.BACKGROUND_MEDIA_DIR]:
    Path(directory).mkdir(parents=True, exist_ok=True)

def resolve_media_path(path_str: Optional[str]) -> Optional[str]:
    """
    Safely resolves media paths between Linux Docker containers (/app/media/...)
    and Windows host (D:/clippilot AI/media/...) or relative paths.
    """
    if not path_str:
        return path_str
    if os.path.exists(path_str):
        return path_str

    normalized = path_str.replace("\\", "/")
    if "/media/" in normalized:
        rel = normalized.split("/media/", 1)[1]
        
        # Candidate 1: In Docker container
        c1 = f"/app/media/{rel}"
        if os.path.exists(c1):
            return c1
            
        # Candidate 2: Relative to current working directory
        c2 = os.path.abspath(os.path.join(".", "media", rel))
        if os.path.exists(c2):
            return c2

        # Candidate 3: Root media
        c3 = os.path.abspath(os.path.join("..", "media", rel))
        if os.path.exists(c3):
            return c3

        # If inside container, default to /app/media/...
        if os.path.exists("/app/media"):
            return c1

    return path_str
