import logging
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from config import settings, resolve_media_path
from services.transcription import transcription_service
from services.gemini_analyzer import gemini_analyzer
from services.scene_detector import scene_detector_service
from services.smart_cropper import smart_cropper
from services.subtitle_generator import subtitle_generator
from services.video_editor import video_editor
from services.quality_checker import quality_checker
from services.video_downloader import video_downloader

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("clippilot.ai_engine")

app = FastAPI(
    title="ClipPilot AI Engine",
    description="Autonomous AI & Video Processing Engine for YouTube Shorts",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request & Response Schemas
class TranscribeRequest(BaseModel):
    videoPath: str
    language: Optional[str] = None

class HighlightAnalysisRequest(BaseModel):
    transcriptData: Dict[str, Any]
    videoMetadata: Dict[str, Any]
    preferredCount: int = Field(default=3, ge=1, le=10)
    minDuration: float = Field(default=15.0, ge=5.0)
    maxDuration: float = Field(default=45.0, le=60.0)

class MetadataGenRequest(BaseModel):
    clipTranscript: str
    sourceTitle: str
    creatorName: Optional[str] = None

class SceneDetectRequest(BaseModel):
    videoPath: str
    threshold: float = 27.0

class SmartCropRequest(BaseModel):
    videoPath: str
    startSec: float
    endSec: float
    aspectRatio: float = 9.0 / 16.0

class DownloadVideoRequest(BaseModel):
    youtubeUrl: str
    videoId: Optional[str] = None

class RenderClipRequest(BaseModel):
    sourceVideoPath: str
    startSec: float
    endSec: float
    outputPath: str
    editingFormat: str = "SPLIT_SCREEN" # SPLIT_SCREEN, FULL_SCREEN, or FACECAM
    backgroundMediaPath: Optional[str] = None
    wordsOrSegments: Optional[List[Dict[str, Any]]] = None
    presetName: str = "Dynamic Captions"
    splitRatio: float = 0.5
    burnSubtitles: bool = True
    targetWidth: int = 1080
    targetHeight: int = 1920
    fps: int = 30
    videoBitrate: str = "4500k"
    audioBitrate: str = "192k"
    fontName: str = "Montserrat"
    fontSize: int = 64
    primaryColor: str = "&H00FFFFFF"
    highlightColor: str = "&H0000FFFF"
    outlineColor: str = "&H00000000"
    outlineWidth: float = 3.5
    captionPosition: str = "center"
    animationType: str = "word_highlight"
    facecamPosition: str = "top_right"
    facecamSize: str = "medium"
    facecamBorderWidth: float = 4.0
    facecamBorderColor: str = "#3B82F6"
    subtleZoom: bool = False
    cropMode: str = "smart"

class GenerateThumbnailRequest(BaseModel):
    videoPath: str
    outputPath: str
    timestampSec: float = 1.0

class QualityCheckRequest(BaseModel):
    videoPath: str
    expectedMinDuration: float = 5.0
    expectedMaxDuration: float = 65.0
    expectedWidth: int = 1080
    expectedHeight: int = 1920

@app.get("/health")
def health_check():
    has_gemini = bool(settings.GEMINI_API_KEY)
    ffmpeg_available = bool(video_editor.ffmpeg_cmd)
    ffprobe_available = bool(quality_checker.ffprobe_cmd)
    return {
        "status": "healthy",
        "service": "ClipPilot AI Engine",
        "ffmpeg": {
            "cmd": video_editor.ffmpeg_cmd,
            "available": ffmpeg_available
        },
        "ffprobe": {
            "cmd": quality_checker.ffprobe_cmd,
            "available": ffprobe_available
        },
        "geminiConfigured": has_gemini,
        "whisperModel": settings.WHISPER_MODEL,
        "whisperComputeType": settings.WHISPER_COMPUTE_TYPE
    }

@app.post("/api/transcribe")
def transcribe(req: TranscribeRequest):
    try:
        resolved_path = resolve_media_path(req.videoPath) or req.videoPath
        result = transcription_service.transcribe_audio(resolved_path, req.language)
        return result
    except Exception as e:
        logger.error(f"Transcription error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-highlights")
def analyze_highlights(req: HighlightAnalysisRequest):
    try:
        highlights = gemini_analyzer.analyze_transcript_highlights(
            transcript_data=req.transcriptData,
            video_metadata=req.videoMetadata,
            preferred_count=req.preferredCount,
            min_duration=req.minDuration,
            max_duration=req.maxDuration
        )
        return {"highlights": highlights}
    except Exception as e:
        logger.error(f"Highlight analysis error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-metadata")
def generate_metadata(req: MetadataGenRequest):
    try:
        metadata = gemini_analyzer.generate_clip_metadata(
            clip_transcript=req.clipTranscript,
            source_title=req.sourceTitle,
            creator_name=req.creatorName
        )
        return metadata
    except Exception as e:
        logger.error(f"Metadata generation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/detect-scenes")
def detect_scenes(req: SceneDetectRequest):
    try:
        scenes = scene_detector_service.detect_scenes(req.videoPath, req.threshold)
        return {"scenes": scenes}
    except Exception as e:
        logger.error(f"Scene detection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/smart-crop")
def analyze_smart_crop(req: SmartCropRequest):
    try:
        resolved_path = resolve_media_path(req.videoPath) or req.videoPath
        crop_data = smart_cropper.analyze_crop_window(
            video_path=resolved_path,
            start_sec=req.startSec,
            end_sec=req.endSec,
            target_aspect_ratio=req.aspectRatio
        )
        return crop_data
    except Exception as e:
        logger.error(f"Smart crop error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/render-clip")
def render_clip_endpoint(req: RenderClipRequest):
    try:
        src_path = resolve_media_path(req.sourceVideoPath) or req.sourceVideoPath
        out_path = resolve_media_path(req.outputPath) or req.outputPath
        bg_path = resolve_media_path(req.backgroundMediaPath) if req.backgroundMediaPath else None

        render_res = video_editor.render_clip(
            source_video_path=src_path,
            start_sec=req.startSec,
            end_sec=req.endSec,
            output_path=out_path,
            editing_format=req.editingFormat,
            background_media_path=bg_path,
            words_or_segments=req.wordsOrSegments,
            preset_name=req.presetName,
            split_ratio=req.splitRatio,
            burn_subtitles=req.burnSubtitles,
            target_width=req.targetWidth,
            target_height=req.targetHeight,
            fps=req.fps,
            video_bitrate=req.videoBitrate,
            audio_bitrate=req.audioBitrate,
            font_name=req.fontName,
            font_size=req.fontSize,
            primary_color=req.primaryColor,
            highlight_color=req.highlightColor,
            outline_color=req.outlineColor,
            outline_width=req.outlineWidth,
            caption_position=req.captionPosition,
            animation_type=req.animationType,
            facecam_position=req.facecamPosition,
            facecam_size=req.facecamSize,
            facecam_border_width=req.facecamBorderWidth,
            facecam_border_color=req.facecamBorderColor,
            subtle_zoom=req.subtleZoom,
            crop_mode=req.cropMode
        )
        return render_res
    except Exception as e:
        logger.error(f"Render error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/validate-quality")
def validate_quality(req: QualityCheckRequest):
    try:
        resolved_path = resolve_media_path(req.videoPath) or req.videoPath
        validation_res = quality_checker.inspect_and_validate(
            video_path=resolved_path,
            expected_min_duration=req.expectedMinDuration,
            expected_max_duration=req.expectedMaxDuration,
            expected_width=req.expectedWidth,
            expected_height=req.expectedHeight
        )
        return validation_res
    except Exception as e:
        logger.error(f"Quality validation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/download-video")
def download_video(req: DownloadVideoRequest):
    try:
        result = video_downloader.download(req.youtubeUrl, req.videoId)
        return result
    except Exception as e:
        logger.error(f"Video download error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-thumbnail")
def generate_thumbnail_endpoint(req: GenerateThumbnailRequest):
    try:
        src = resolve_media_path(req.videoPath) or req.videoPath
        out = resolve_media_path(req.outputPath) or req.outputPath
        os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
        res = video_editor.generate_thumbnail(src, req.timestampSec, out)
        return {"success": True, "thumbnailPath": res}
    except Exception as e:
        logger.error(f"Thumbnail generation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.AI_ENGINE_HOST, port=settings.AI_ENGINE_PORT)
