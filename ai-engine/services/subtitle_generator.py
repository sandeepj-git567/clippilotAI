import os
import math
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("clippilot.subtitle_generator")

class SubtitleGeneratorService:
    def format_ass_time(self, seconds: float) -> str:
        """Converts seconds into ASS time format: H:MM:SS.cc"""
        if seconds < 0:
            seconds = 0.0
        hrs = int(seconds // 3600)
        mins = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        csecs = int(round((seconds - math.floor(seconds)) * 100))
        if csecs >= 100:
            csecs = 99
        return f"{hrs}:{mins:02d}:{secs:02d}.{csecs:02d}"

    def generate_ass_subtitles(
        self,
        words_or_segments: List[Dict[str, Any]],
        output_ass_path: str,
        clip_start_sec: float,
        clip_end_sec: float,
        preset_name: str = "Dynamic Captions",
        font_name: str = "Arial",
        font_size: int = 68,
        primary_color: str = "&H00FFFFFF",     # White
        highlight_color: str = "&H0000FFFF",   # Vibrant Yellow
        outline_color: str = "&H00000000",     # Black
        outline_width: float = 4.0,
        vertical_position: int = 700           # MarginV for 1080x1920
    ) -> str:
        """
        Generates an ASS subtitle file formatted for 1080x1920 vertical video
        with word-level animation and highlighting presets.
        """
        os.makedirs(os.path.dirname(os.path.abspath(output_ass_path)), exist_ok=True)

        header = f"""[Script Info]
Title: ClipPilot AI Captions
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_name},{font_size},{primary_color},&H000000FF,{outline_color},&H80000000,-1,0,0,0,100,100,0,0,1,{outline_width},2,2,60,60,{vertical_position},1
Style: Highlight,{font_name},{int(font_size * 1.05)},{highlight_color},&H000000FF,{outline_color},&H80000000,-1,0,0,0,105,105,0,0,1,{outline_width + 1.0},3,2,60,60,{vertical_position},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

        events: List[str] = []

        # Filter words/segments that fall inside [clip_start_sec, clip_end_sec]
        # Check if words are available
        all_words: List[Dict[str, Any]] = []
        for item in words_or_segments:
            if "words" in item and item["words"]:
                for w in item["words"]:
                    w_start = float(w["start"])
                    w_end = float(w["end"])
                    if w_end > clip_start_sec and w_start < clip_end_sec:
                        # Normalize timestamps relative to clip start
                        all_words.append({
                            "word": w["word"].strip(),
                            "start": max(0.0, w_start - clip_start_sec),
                            "end": max(0.0, w_end - clip_start_sec)
                        })
            elif "startSec" in item:
                # Segment level fallback
                s_start = float(item["startSec"])
                s_end = float(item["endSec"])
                if s_end > clip_start_sec and s_start < clip_end_sec:
                    text_words = item["text"].split()
                    seg_dur = max(0.1, s_end - s_start)
                    w_dur = seg_dur / max(1, len(text_words))
                    for i, tw in enumerate(text_words):
                        tw_start = s_start + (i * w_dur)
                        tw_end = tw_start + w_dur
                        all_words.append({
                            "word": tw.strip(),
                            "start": max(0.0, tw_start - clip_start_sec),
                            "end": max(0.0, tw_end - clip_start_sec)
                        })

        if not all_words:
            # Fallback dialogue
            dialogue = f"Dialogue: 0,0:00:00.00,0:00:03.00,Default,,0,0,0,,{preset_name}"
            events.append(dialogue)
        else:
            # Group into chunks of 3-5 words for fast-paced vertical video readability
            CHUNK_SIZE = 4
            word_chunks = [all_words[i:i + CHUNK_SIZE] for i in range(0, len(all_words), CHUNK_SIZE)]

            for chunk in word_chunks:
                if not chunk:
                    continue
                chunk_start = chunk[0]["start"]
                chunk_end = chunk[-1]["end"]

                # Ensure minimum readability duration
                if chunk_end <= chunk_start:
                    chunk_end = chunk_start + 0.4

                if preset_name in ["Dynamic Captions", "Highlight Captions"]:
                    # Animate each word in chunk with active highlight
                    for active_idx, active_word in enumerate(chunk):
                        w_start = active_word["start"]
                        w_end = active_word["end"]
                        if w_end <= w_start:
                            w_end = w_start + 0.3

                        # Build sentence where active word is highlighted with enlarged font & highlight color
                        text_parts = []
                        for idx, w in enumerate(chunk):
                            clean_w = w["word"].upper()
                            if idx == active_idx:
                                # Highlighted and popped
                                text_parts.append(f"{{\\c{highlight_color}\\fscx112\\fscy112}}{clean_w}{{\\r}}")
                            else:
                                text_parts.append(clean_w)

                        line_text = " ".join(text_parts)
                        t_start_str = self.format_ass_time(w_start)
                        t_end_str = self.format_ass_time(w_end)
                        events.append(f"Dialogue: 0,{t_start_str},{t_end_str},Default,,0,0,0,,{line_text}")
                else:
                    # Clean Captions / Minimal Editorial: Solid clear subtitles without rapid pop
                    line_text = " ".join([w["word"].upper() for w in chunk])
                    t_start_str = self.format_ass_time(chunk_start)
                    t_end_str = self.format_ass_time(chunk_end)
                    events.append(f"Dialogue: 0,{t_start_str},{t_end_str},Default,,0,0,0,,{line_text}")

        with open(output_ass_path, "w", encoding="utf-8") as f:
            f.write(header + "\n".join(events) + "\n")

        logger.info(f"Generated ASS subtitle file: {output_ass_path} ({len(events)} dialogue lines)")
        return output_ass_path

subtitle_generator = SubtitleGeneratorService()
