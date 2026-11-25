import os
import subprocess
import logging
import json
import uuid
from typing import Dict, Any, Optional
from config import settings
from services.smart_cropper import smart_cropper
from services.subtitle_generator import subtitle_generator

logger = logging.getLogger("clippilot.video_editor")

class VideoEditorService:
    def __init__(self):
        self.ffmpeg_cmd = self._resolve_ffmpeg()
        self.ffprobe_cmd = self._resolve_ffprobe()

    def _resolve_ffmpeg(self) -> str:
        try:
            res = subprocess.run(["ffmpeg", "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            if res.returncode == 0:
                return "ffmpeg"
        except Exception:
            pass

        if os.path.exists(settings.FFMPEG_PATH):
            return settings.FFMPEG_PATH
        return "ffmpeg"

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

    def _escape_filter_path(self, path: str) -> str:
        """
        Escapes paths for FFmpeg complex filter strings (handling Windows drive letters and colons).
        e.g. D:/path -> D\\:/path
        """
        p = path.replace("\\", "/")
        if len(p) > 1 and p[1] == ":":
            p = p[0] + "\\:" + p[2:]
        return p

    def render_clip(
        self,
        source_video_path: str,
        start_sec: float,
        end_sec: float,
        output_path: str,
        editing_format: str = "SPLIT_SCREEN",
        background_media_path: Optional[str] = None,
        words_or_segments: Optional[list] = None,
        preset_name: str = "Dynamic Captions",
        split_ratio: float = 0.5,
        burn_subtitles: bool = True,
        target_width: int = 1080,
        target_height: int = 1920,
        fps: int = 30,
        video_bitrate: str = "4500k",
        audio_bitrate: str = "192k",
        font_name: str = "Montserrat",
        font_size: int = 64,
        primary_color: str = "&H00FFFFFF",
        highlight_color: str = "&H0000FFFF",
        outline_color: str = "&H00000000",
        outline_width: float = 3.5,
        caption_position: str = "center",
        animation_type: str = "word_highlight",
        facecam_position: str = "top_right",
        facecam_size: str = "medium",
        facecam_border_width: float = 4.0,
        facecam_border_color: str = "#3B82F6",
        subtle_zoom: bool = False,
        crop_mode: str = "smart"
    ) -> Dict[str, Any]:
        """
        Renders a 9:16 vertical video clip (1080x1920) using FFmpeg.
        Supports:
        1. MODE 1: SPLIT_SCREEN with upper source clip and lower gameplay/background.
        2. MODE 2: FULL_SCREEN with smart crop and dynamic reframing.
        3. MODE 3: FACECAM with intelligent streamer facecam detection, Picture-in-Picture composition,
           border styling, and fallback.
        Includes EBU R128 audio normalization and customizable animated ASS subtitles.
        """
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        clip_duration = max(0.5, end_sec - start_sec)
        has_facecam = False

        logger.info(
            f"Rendering clip: format={editing_format}, start={start_sec}s, end={end_sec}s, duration={clip_duration:.2f}s"
        )

        # Calculate vertical position (MarginV) for ASS subtitles:
        # Default center: MarginV ~ 750 (for 1080x1920)
        # Bottom: MarginV ~ 240
        # Top: MarginV ~ 1500
        margin_v = 750
        if caption_position == "bottom":
            margin_v = 240
        elif caption_position == "top":
            margin_v = 1500

        # Generate ASS subtitle file if requested
        ass_path = None
        if burn_subtitles and words_or_segments:
            ass_filename = f"sub_{uuid.uuid4().hex[:8]}.ass"
            ass_path = os.path.join(settings.VIDEO_TEMP_DIR, ass_filename)
            subtitle_generator.generate_ass_subtitles(
                words_or_segments=words_or_segments,
                output_ass_path=ass_path,
                clip_start_sec=start_sec,
                clip_end_sec=end_sec,
                preset_name=preset_name,
                font_name=font_name,
                font_size=font_size,
                primary_color=primary_color,
                highlight_color=highlight_color,
                outline_color=outline_color,
                outline_width=outline_width,
                vertical_position=margin_v
            )

        # Smart Cropping Analysis
        crop_info = smart_cropper.analyze_crop_window(
            video_path=source_video_path,
            start_sec=start_sec,
            end_sec=end_sec,
            target_aspect_ratio=(target_width / target_height) if editing_format != "SPLIT_SCREEN" else (target_width / (target_height * split_ratio))
        )

        escaped_ass = self._escape_filter_path(ass_path) if ass_path else None

        if editing_format == "SPLIT_SCREEN":
            upper_h = int(target_height * split_ratio)
            if upper_h % 2 != 0:
                upper_h -= 1
            lower_h = target_height - upper_h

            has_bg_file = background_media_path and os.path.exists(background_media_path)

            if has_bg_file:
                is_bg_image = background_media_path.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))
                filter_complex = (
                    f"[0:v]setpts=PTS-STARTPTS,"
                    f"scale={target_width}:{upper_h}:force_original_aspect_ratio=increase,"
                    f"crop={target_width}:{upper_h},setsar=1[upper];"
                    f"[1:v]setpts=PTS-STARTPTS,"
                    f"scale={target_width}:{lower_h}:force_original_aspect_ratio=increase,"
                    f"crop={target_width}:{lower_h},setsar=1[lower];"
                    f"[upper][lower]vstack=inputs=2[stacked]"
                )
                if escaped_ass:
                    filter_complex += f";[stacked]ass='{escaped_ass}'[v_out]"
                else:
                    filter_complex += ";[stacked]null[v_out]"

                bg_input_args = ["-loop", "1", "-t", str(clip_duration), "-i", background_media_path] if is_bg_image else [
                    "-stream_loop", "-1", "-ss", "0", "-t", str(clip_duration), "-i", background_media_path
                ]

                cmd = [
                    self.ffmpeg_cmd, "-y",
                    "-ss", str(start_sec), "-t", str(clip_duration), "-i", source_video_path,
                    *bg_input_args,
                    "-filter_complex", filter_complex,
                    "-map", "[v_out]",
                    "-map", "0:a?",
                    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                    "-c:v", "libx264", "-preset", "fast", "-b:v", video_bitrate,
                    "-r", str(fps), "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", audio_bitrate, "-ar", "44100",
                    "-t", str(clip_duration),
                    output_path
                ]
            else:
                filter_complex = (
                    f"[0:v]setpts=PTS-STARTPTS,"
                    f"scale={target_width}:{upper_h}:force_original_aspect_ratio=increase,"
                    f"crop={target_width}:{upper_h},setsar=1[upper];"
                    f"[0:v]setpts=PTS-STARTPTS,"
                    f"scale={target_width}:{lower_h}:force_original_aspect_ratio=increase,"
                    f"crop={target_width}:{lower_h},boxblur=20:10,setsar=1[lower];"
                    f"[upper][lower]vstack=inputs=2[stacked]"
                )
                if escaped_ass:
                    filter_complex += f";[stacked]ass='{escaped_ass}'[v_out]"
                else:
                    filter_complex += ";[stacked]null[v_out]"

                cmd = [
                    self.ffmpeg_cmd, "-y",
                    "-ss", str(start_sec), "-t", str(clip_duration), "-i", source_video_path,
                    "-filter_complex", filter_complex,
                    "-map", "[v_out]",
                    "-map", "0:a?",
                    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                    "-c:v", "libx264", "-preset", "fast", "-b:v", video_bitrate,
                    "-r", str(fps), "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", audio_bitrate, "-ar", "44100",
                    "-t", str(clip_duration),
                    output_path
                ]

        elif editing_format == "FACECAM":
            # Intelligent Streamer Facecam Detection
            facecam_data = smart_cropper.detect_facecam_region(
                video_path=source_video_path,
                start_sec=start_sec,
                end_sec=end_sec
            )
            has_facecam = facecam_data.get("has_facecam", False)

            if has_facecam:
                logger.info(f"Streamer facecam detected in {facecam_data.get('quadrant')}. Rendering PiP composition.")
                cam_x = facecam_data["crop_x"]
                cam_y = facecam_data["crop_y"]
                cam_w = facecam_data["crop_w"]
                cam_h = facecam_data["crop_h"]

                # Sizing based on preset
                if facecam_size == "small":
                    overlay_w = 340
                elif facecam_size == "large":
                    overlay_w = 480
                else:
                    overlay_w = 400

                overlay_h = int(overlay_w * (cam_h / max(1, cam_w)))
                if overlay_h % 2 != 0:
                    overlay_h -= 1

                # Positioning
                pos = facecam_position or "top_right"
                if pos == "top_left":
                    overlay_x = 40
                    overlay_y = 80
                elif pos == "bottom_left":
                    overlay_x = 40
                    overlay_y = target_height - overlay_h - 240
                elif pos == "bottom_right":
                    overlay_x = target_width - overlay_w - 40
                    overlay_y = target_height - overlay_h - 240
                else: # top_right
                    overlay_x = target_width - overlay_w - 40
                    overlay_y = 80

                hex_col = facecam_border_color.replace("#", "0x") if (facecam_border_color and facecam_border_color.startswith("#")) else "0x3B82F6"
                border_w = int(facecam_border_width or 4.0)

                filter_complex = (
                    f"[0:v]setpts=PTS-STARTPTS,"
                    f"scale={target_width}:{target_height}:force_original_aspect_ratio=increase,"
                    f"crop={target_width}:{target_height},setsar=1[main_bg];"
                    f"[0:v]setpts=PTS-STARTPTS,"
                    f"crop={cam_w}:{cam_h}:{cam_x}:{cam_y},"
                    f"scale={overlay_w}:{overlay_h}:flags=lanczos,setsar=1,"
                    f"drawbox=x=0:y=0:w=iw:h=ih:color={hex_col}@1:t={border_w}[cam_overlay];"
                    f"[main_bg][cam_overlay]overlay={overlay_x}:{overlay_y}[comp]"
                )
                if escaped_ass:
                    filter_complex += f";[comp]ass='{escaped_ass}'[v_out]"
                else:
                    filter_complex += ";[comp]null[v_out]"

                cmd = [
                    self.ffmpeg_cmd, "-y",
                    "-ss", str(start_sec), "-t", str(clip_duration), "-i", source_video_path,
                    "-filter_complex", filter_complex,
                    "-map", "[v_out]",
                    "-map", "0:a?",
                    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                    "-c:v", "libx264", "-preset", "fast", "-b:v", video_bitrate,
                    "-r", str(fps), "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", audio_bitrate, "-ar", "44100",
                    "-t", str(clip_duration),
                    output_path
                ]
            else:
                logger.info("Facecam not detected in perimeter. Intelligently falling back to Full Screen Smart Crop.")
                crop_w = crop_info["crop_w"]
                crop_h = crop_info["crop_h"]
                crop_x = crop_info["crop_x"]
                crop_y = crop_info["crop_y"]

                filter_complex = (
                    f"[0:v]setpts=PTS-STARTPTS,"
                    f"crop={crop_w}:{crop_h}:{crop_x}:{crop_y},"
                    f"scale={target_width}:{target_height}:flags=lanczos,setsar=1[scaled]"
                )
                if escaped_ass:
                    filter_complex += f";[scaled]ass='{escaped_ass}'[v_out]"
                else:
                    filter_complex += ";[scaled]null[v_out]"

                cmd = [
                    self.ffmpeg_cmd, "-y",
                    "-ss", str(start_sec), "-t", str(clip_duration), "-i", source_video_path,
                    "-filter_complex", filter_complex,
                    "-map", "[v_out]",
                    "-map", "0:a?",
                    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                    "-c:v", "libx264", "-preset", "fast", "-b:v", video_bitrate,
                    "-r", str(fps), "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", audio_bitrate, "-ar", "44100",
                    "-t", str(clip_duration),
                    output_path
                ]

        else:
            # MODE: FULL_SCREEN
            crop_w = crop_info["crop_w"]
            crop_h = crop_info["crop_h"]
            crop_x = crop_info["crop_x"]
            crop_y = crop_info["crop_y"]

            filter_complex = (
                f"[0:v]setpts=PTS-STARTPTS,"
                f"crop={crop_w}:{crop_h}:{crop_x}:{crop_y},"
                f"scale={target_width}:{target_height}:flags=lanczos,setsar=1[scaled]"
            )
            if escaped_ass:
                filter_complex += f";[scaled]ass='{escaped_ass}'[v_out]"
            else:
                filter_complex += ";[scaled]null[v_out]"

            cmd = [
                self.ffmpeg_cmd, "-y",
                "-ss", str(start_sec), "-t", str(clip_duration), "-i", source_video_path,
                "-filter_complex", filter_complex,
                "-map", "[v_out]",
                "-map", "0:a?",
                "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                "-c:v", "libx264", "-preset", "fast", "-b:v", video_bitrate,
                "-r", str(fps), "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", audio_bitrate, "-ar", "44100",
                "-t", str(clip_duration),
                output_path
            ]

        logger.info(f"Executing FFmpeg render command: {' '.join(cmd)}")
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

        if ass_path and os.path.exists(ass_path):
            try:
                os.remove(ass_path)
            except Exception:
                pass

        if proc.returncode != 0:
            logger.error(f"FFmpeg execution failed with code {proc.returncode}:\n{proc.stderr}")
            raise RuntimeError(f"FFmpeg render error: {proc.stderr[-1000:]}")

        logger.info(f"Video rendered successfully: {output_path}")

        thumb_time = min(1.5, clip_duration / 2.0)
        thumb_path = output_path.rsplit(".", 1)[0] + "_thumb.jpg"
        self.generate_thumbnail(output_path, thumb_time, thumb_path)

        return {
            "outputFilePath": output_path,
            "thumbnailPath": thumb_path,
            "durationSec": clip_duration,
            "format": editing_format,
            "resolution": f"{target_width}x{target_height}",
            "hasFacecam": has_facecam if editing_format == "FACECAM" else None,
            "facecamFallback": (editing_format == "FACECAM" and not has_facecam)
        }

    def generate_thumbnail(self, video_path: str, timestamp_sec: float, output_thumb_path: str) -> str:
        """Generates a high quality JPEG thumbnail from the video at timestamp."""
        cmd = [
            self.ffmpeg_cmd, "-y",
            "-ss", str(timestamp_sec),
            "-i", video_path,
            "-vframes", "1",
            "-q:v", "2",
            output_thumb_path
        ]
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return output_thumb_path

video_editor = VideoEditorService()
