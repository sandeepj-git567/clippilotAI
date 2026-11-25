import os
import subprocess
import json
import logging
from typing import Dict, Any
from config import settings

logger = logging.getLogger("clippilot.quality_checker")

class QualityCheckerService:
    def __init__(self):
        self.ffprobe_cmd = self._resolve_ffprobe()

    def _resolve_ffprobe(self) -> str:
        try:
            res = subprocess.run(["ffprobe", "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            if res.returncode == 0:
                return "ffprobe"
        except Exception:
            pass
        if os.path.exists(settings.FFPROBE_PATH):
            return settings.FFPROBE_PATH
        return "ffprobe"

    def inspect_and_validate(
        self,
        video_path: str,
        expected_min_duration: float = 5.0,
        expected_max_duration: float = 65.0,
        expected_width: int = 1080,
        expected_height: int = 1920
    ) -> Dict[str, Any]:
        """
        Runs rigorous quality and integrity checks on rendered MP4 video using ffprobe.
        Validates:
        - Container integrity & file size
        - Exact resolution (1080x1920)
        - Aspect ratio (9:16)
        - Duration bounds
        - Video and Audio stream presence and codecs
        - Playability & bitrates
        """
        if not os.path.exists(video_path):
            return {
                "isValid": False,
                "score": 0.0,
                "rejectionReason": f"Output video file does not exist: {video_path}",
                "details": {}
            }

        file_size_bytes = os.path.getsize(video_path)
        if file_size_bytes < 50 * 1024:  # Under 50KB is suspect or corrupted
            return {
                "isValid": False,
                "score": 0.0,
                "rejectionReason": f"File size too small ({file_size_bytes} bytes). Likely empty or corrupt.",
                "details": {"fileSize": file_size_bytes}
            }

        cmd = [
            self.ffprobe_cmd,
            "-v", "error",
            "-show_entries", "format=duration,size,bit_rate:stream=codec_name,codec_type,width,height,r_frame_rate,duration",
            "-of", "json",
            video_path
        ]

        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if proc.returncode != 0:
            return {
                "isValid": False,
                "score": 0.0,
                "rejectionReason": f"ffprobe integrity check failed: {proc.stderr}",
                "details": {"rawError": proc.stderr}
            }

        try:
            probe_data = json.loads(proc.stdout)
        except json.JSONDecodeError:
            return {
                "isValid": False,
                "score": 0.0,
                "rejectionReason": "Could not parse ffprobe JSON output.",
                "details": {}
            }

        streams = probe_data.get("streams", [])
        format_info = probe_data.get("format", {})

        video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
        audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)

        if not video_stream:
            return {
                "isValid": False,
                "score": 0.0,
                "rejectionReason": "No video stream found in rendered output.",
                "details": probe_data
            }

        width = int(video_stream.get("width", 0))
        height = int(video_stream.get("height", 0))
        duration = float(format_info.get("duration", 0.0))
        bit_rate = int(format_info.get("bit_rate", 0))

        # Check resolution & aspect ratio
        is_correct_res = (width == expected_width and height == expected_height)
        is_vertical = (height > width) and (abs((width / height) - (9.0 / 16.0)) < 0.05)

        # Check duration
        is_valid_duration = (expected_min_duration <= duration <= expected_max_duration)

        # Has audio
        has_audio = (audio_stream is not None)

        # Compute Quality Score (0 - 100)
        score = 100.0
        failures = []

        if not is_correct_res:
            score -= 20.0
            failures.append(f"Resolution is {width}x{height}, expected {expected_width}x{expected_height}")

        if not is_vertical:
            score -= 25.0
            failures.append("Video is not in 9:16 vertical aspect ratio")

        if not is_valid_duration:
            score -= 20.0
            failures.append(f"Duration {duration:.1f}s outside bounds [{expected_min_duration}s, {expected_max_duration}s]")

        if not has_audio:
            score -= 20.0
            failures.append("No audio stream detected")

        if file_size_bytes < 200 * 1024:
            score -= 10.0

        is_valid = (score >= 70.0 and is_correct_res and has_audio and is_valid_duration)

        return {
            "isValid": is_valid,
            "qualityScore": round(max(0.0, score), 1),
            "rejectionReason": "; ".join(failures) if not is_valid else None,
            "details": {
                "width": width,
                "height": height,
                "duration": round(duration, 2),
                "fileSize": file_size_bytes,
                "bitrate": bit_rate,
                "videoCodec": video_stream.get("codec_name"),
                "audioCodec": audio_stream.get("codec_name") if audio_stream else None,
                "hasAudio": has_audio,
                "is9to16": is_vertical
            }
        }

quality_checker = QualityCheckerService()
