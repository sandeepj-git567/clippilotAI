import os
import re
import json
import logging
import subprocess
from typing import Optional, Dict, Any
import yt_dlp
from config import settings, resolve_media_path

logger = logging.getLogger("clippilot.video_downloader")

class VideoDownloaderService:
    def __init__(self):
        self.ffprobe_cmd = settings.FFPROBE_PATH or "ffprobe"

    def extract_video_id(self, url: str) -> Optional[str]:
        if not url:
            return None
        patterns = [
            r'(?:v=|\/)([0-9A-Za-z_-]{11}).*',
            r'youtu\.be\/([0-9A-Za-z_-]{11})',
            r'shorts\/([0-9A-Za-z_-]{11})'
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None

    def probe_video(self, file_path: str) -> Dict[str, Any]:
        """Runs ffprobe on the target video to return duration, dimensions, and size."""
        try:
            cmd = [
                self.ffprobe_cmd,
                "-v", "error",
                "-show_entries", "format=duration,size:stream=width,height",
                "-of", "json",
                file_path
            ]
            res = subprocess.run(cmd, capture_output=True, text=True, check=True)
            data = json.loads(res.stdout)
            
            duration = float(data.get("format", {}).get("duration", 0.0))
            size = int(data.get("format", {}).get("size", os.path.getsize(file_path)))
            
            width = 1920
            height = 1080
            for stream in data.get("streams", []):
                if stream.get("width") and stream.get("height"):
                    width = int(stream["width"])
                    height = int(stream["height"])
                    break

            return {
                "duration": duration,
                "width": width,
                "height": height,
                "fileSize": size
            }
        except Exception as e:
            logger.warning(f"ffprobe failed for {file_path}: {e}")
            size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
            return {
                "duration": 60.0,
                "width": 1920,
                "height": 1080,
                "fileSize": size
            }

    def download(self, youtube_url: str, video_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Downloads a YouTube video to the uploads directory using yt-dlp.
        If already downloaded and valid, returns cached file info immediately.
        """
        extracted_id = video_id or self.extract_video_id(youtube_url) or "video"
        output_dir = settings.VIDEO_UPLOADS_DIR
        os.makedirs(output_dir, exist_ok=True)
        
        target_path = os.path.join(output_dir, f"yt_{extracted_id}.mp4")

        # Check if already present and valid (> 1MB)
        if os.path.exists(target_path) and os.path.getsize(target_path) > 1000000:
            logger.info(f"Using pre-existing local media: {target_path} ({os.path.getsize(target_path)} bytes)")
            probe_meta = self.probe_video(target_path)
            return {
                "filePath": target_path,
                **probe_meta
            }

        logger.info(f"Downloading YouTube video ({extracted_id}) from: {youtube_url}")

        ydl_opts = {
            'format': 'bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/bv*[height<=720]+ba/b[height<=720]/best',
            'merge_output_format': 'mp4',
            'outtmpl': os.path.join(output_dir, f"yt_{extracted_id}.%(ext)s"),
            'extractor_args': {
                'youtube': {
                    'player_client': ['android', 'ios', 'web']
                }
            },
            'quiet': False,
            'no_warnings': True,
            'overwrites': True
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([youtube_url])

        if not os.path.exists(target_path):
            # Check if saved with a different extension
            for ext in ['mp4', 'mkv', 'webm']:
                cand = os.path.join(output_dir, f"yt_{extracted_id}.{ext}")
                if os.path.exists(cand):
                    target_path = cand
                    break

        if not os.path.exists(target_path) or os.path.getsize(target_path) < 1000:
            raise RuntimeError(f"Download failed: target file {target_path} was not created or is empty.")

        probe_meta = self.probe_video(target_path)
        logger.info(f"Successfully downloaded {extracted_id}: {probe_meta}")

        return {
            "filePath": target_path,
            **probe_meta
        }

video_downloader = VideoDownloaderService()
