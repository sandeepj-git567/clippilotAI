import logging
import os
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional
from faster_whisper import WhisperModel
from config import settings

logger = logging.getLogger("clippilot.transcription")

class TranscriptionService:
    def __init__(self, model_size: str = None, compute_type: str = None):
        self.model_size = model_size or settings.WHISPER_MODEL
        self.compute_type = compute_type or settings.WHISPER_COMPUTE_TYPE
        self._model = None

    def get_model(self) -> WhisperModel:
        if self._model is None:
            logger.info(f"Loading WhisperModel(model_size={self.model_size}, device=cpu, compute_type={self.compute_type})")
            self._model = WhisperModel(
                self.model_size,
                device="cpu",
                compute_type=self.compute_type,
                cpu_threads=4
            )
        return self._model

    def _extract_audio_track(self, video_path: str) -> str:
        """
        Extracts a lightweight 16kHz mono 64kbps MP3 audio file using ffmpeg.
        Transcribing an extracted audio file is 5x-10x faster than reading a 400MB+ full video container.
        """
        temp_dir = Path(settings.VIDEO_TEMP_DIR)
        temp_dir.mkdir(parents=True, exist_ok=True)
        base_name = Path(video_path).stem
        audio_out = str(temp_dir / f"audio_{base_name}_{os.getpid()}.mp3")

        # For very long videos (> 30 mins), limit audio extraction to the first 30 mins to avoid CPU OOM
        cmd = [
            settings.FFMPEG_PATH or "ffmpeg",
            "-y",
            "-i", video_path,
            "-t", "1800",
            "-vn",
            "-ac", "1",
            "-ar", "16000",
            "-b:a", "64k",
            audio_out
        ]

        logger.info(f"Extracting lightweight audio from video: {' '.join(cmd)}")
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if res.returncode == 0 and os.path.exists(audio_out):
            return audio_out

        logger.warning(f"Audio extraction fallback: ffmpeg failed with code {res.returncode}. Using original video.")
        return video_path

    def get_youtube_transcript(self, video_id: str, languages: tuple = ('en', 'en-US')) -> Optional[Dict[str, Any]]:
        """
        Fetches official YouTube captions using youtube-transcript-api.
        Provides instant 0-second transcript retrieval for YouTube videos.
        """
        try:
            from youtube_transcript_api import YouTubeTranscriptApi
            logger.info(f"Checking YouTube Captions/Transcript API for video ID: {video_id}")
            api = YouTubeTranscriptApi()
            raw_transcript = None
            try:
                raw_transcript = api.fetch(video_id, languages=languages)
            except Exception:
                try:
                    raw_transcript = api.fetch(video_id)
                except Exception:
                    transcript_list = api.list(video_id)
                    for t in transcript_list:
                        raw_transcript = t.fetch()
                        if raw_transcript:
                            break

            if not raw_transcript:
                return None

            segments_list = []
            full_text_parts = []
            total_duration = 0.0

            for idx, item in enumerate(raw_transcript):
                text = (getattr(item, 'text', '') if hasattr(item, 'text') else item.get('text', '')).strip()
                start = round(float(getattr(item, 'start', 0.0) if hasattr(item, 'start') else item.get('start', 0.0)), 3)
                duration = round(float(getattr(item, 'duration', 0.0) if hasattr(item, 'duration') else item.get('duration', 0.0)), 3)
                end = round(start + duration, 3)
                total_duration = max(total_duration, end)

                # Generate word-level approximation for timing captions
                words = text.split()
                w_count = max(1, len(words))
                w_dur = duration / w_count
                words_data = []
                for i, w in enumerate(words):
                    w_start = round(start + (i * w_dur), 3)
                    w_end = round(w_start + w_dur, 3)
                    words_data.append({"word": w, "start": w_start, "end": w_end, "probability": 0.99})

                full_text_parts.append(text)
                segments_list.append({
                    "segmentIndex": idx,
                    "startSec": start,
                    "endSec": end,
                    "text": text,
                    "avgLogprob": 0.0,
                    "noSpeechProb": 0.0,
                    "words": words_data
                })

            logger.info(f"Successfully retrieved YouTube transcript: {len(segments_list)} segments, {total_duration}s")
            return {
                "language": "en",
                "detectedLanguage": "en",
                "languageProbability": 1.0,
                "duration": total_duration,
                "fullText": " ".join(full_text_parts),
                "segments": segments_list
            }
        except Exception as e:
            logger.info(f"No YouTube transcript available via API for {video_id} ({e}). Will use Whisper transcription.")
            return None

    def transcribe_audio(self, audio_or_video_path: str, language: Optional[str] = None) -> Dict[str, Any]:
        """
        Transcribes the given audio or video file with Faster-Whisper.
        Extracts segment-level and word-level timestamps.
        """
        logger.info(f"Starting transcription for file: {audio_or_video_path}")
        
        # Check if this is a YouTube video with available captions
        import re
        yt_match = re.search(r'yt_([a-zA-Z0-9_-]{11})', audio_or_video_path)
        if yt_match:
            yt_id = yt_match.group(1)
            yt_res = self.get_youtube_transcript(yt_id)
            if yt_res and yt_res.get("segments"):
                return yt_res

        model = self.get_model()

        # Extract lightweight audio if it's a video file
        audio_file = audio_or_video_path
        is_temp_audio = False
        if audio_or_video_path.lower().endswith(('.mp4', '.mkv', '.mov', '.webm', '.avi')):
            extracted = self._extract_audio_track(audio_or_video_path)
            if extracted != audio_or_video_path:
                audio_file = extracted
                is_temp_audio = True

        try:
            segments_iter, info = model.transcribe(
                audio_file,
                language=language,
                beam_size=1,  # Greedy/beam=1 is 3x faster with virtually identical accuracy for highlight extraction
                word_timestamps=True,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=500)
            )

            segments_list: List[Dict[str, Any]] = []
            full_text_parts: List[str] = []

            for idx, segment in enumerate(segments_iter):
                words_data = []
                if segment.words:
                    for w in segment.words:
                        words_data.append({
                            "word": w.word.strip(),
                            "start": round(w.start, 3),
                            "end": round(w.end, 3),
                            "probability": round(w.probability, 3)
                        })

                clean_text = segment.text.strip()
                full_text_parts.append(clean_text)

                segments_list.append({
                    "segmentIndex": idx,
                    "startSec": round(segment.start, 3),
                    "endSec": round(segment.end, 3),
                    "text": clean_text,
                    "avgLogprob": round(segment.avg_logprob, 3) if segment.avg_logprob is not None else None,
                    "noSpeechProb": round(segment.no_speech_prob, 3) if segment.no_speech_prob is not None else None,
                    "words": words_data
                })

            full_transcript = " ".join(full_text_parts)
            duration = round(info.duration, 3) if info.duration else 0.0

            logger.info(f"Transcription complete: {len(segments_list)} segments, detected language '{info.language}' (prob {info.language_probability:.2f})")

            return {
                "language": info.language,
                "detectedLanguage": info.language,
                "languageProbability": round(info.language_probability, 3),
                "duration": duration,
                "fullText": full_transcript,
                "segments": segments_list
            }
        finally:
            if is_temp_audio and os.path.exists(audio_file):
                try:
                    os.remove(audio_file)
                except Exception:
                    pass

transcription_service = TranscriptionService()
