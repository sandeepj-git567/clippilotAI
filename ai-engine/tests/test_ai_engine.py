import os
import sys
import subprocess
import pytest
from pathlib import Path

# Add ai-engine root to python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.subtitle_generator import subtitle_generator
from services.smart_cropper import smart_cropper
from services.video_editor import video_editor
from services.quality_checker import quality_checker

TEST_DIR = Path("d:/clippilot AI/media/temp/test_artifacts")
TEST_DIR.mkdir(parents=True, exist_ok=True)

@pytest.fixture(scope="session")
def sample_video():
    """Generates a real 5-second 1280x720 test video with audio using FFmpeg."""
    sample_path = str(TEST_DIR / "test_source.mp4")
    cmd = [
        video_editor.ffmpeg_cmd, "-y",
        "-f", "lavfi", "-i", "testsrc=size=1280x720:rate=30",
        "-f", "lavfi", "-i", "sine=frequency=1000:sample_rate=44100",
        "-t", "5",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        sample_path
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return sample_path

def test_subtitle_generator():
    ass_path = str(TEST_DIR / "test_sub.ass")
    dummy_segments = [
        {
            "segmentIndex": 0,
            "startSec": 0.5,
            "endSec": 2.5,
            "text": "Hello world welcome to ClipPilot AI",
            "words": [
                {"word": "Hello", "start": 0.5, "end": 0.9},
                {"word": "world", "start": 1.0, "end": 1.4},
                {"word": "welcome", "start": 1.5, "end": 1.8},
                {"word": "to", "start": 1.9, "end": 2.1},
                {"word": "ClipPilot", "start": 2.2, "end": 2.5}
            ]
        }
    ]
    out_file = subtitle_generator.generate_ass_subtitles(
        words_or_segments=dummy_segments,
        output_ass_path=ass_path,
        clip_start_sec=0.0,
        clip_end_sec=3.0,
        preset_name="Dynamic Captions"
    )
    assert os.path.exists(out_file)
    with open(out_file, "r", encoding="utf-8") as f:
        content = f.read()
    assert "[Script Info]" in content
    assert "PlayResX: 1080" in content
    assert "PlayResY: 1920" in content
    assert "Dialogue:" in content

def test_smart_cropper(sample_video):
    crop_info = smart_cropper.analyze_crop_window(
        video_path=sample_video,
        start_sec=0.0,
        end_sec=3.0,
        target_aspect_ratio=9.0/16.0
    )
    assert "crop_w" in crop_info
    assert "crop_h" in crop_info
    assert crop_info["crop_w"] <= crop_info["orig_w"]
    assert crop_info["crop_h"] == crop_info["orig_h"]

def test_render_clip_full_screen(sample_video):
    out_path = str(TEST_DIR / "test_out_fullscreen.mp4")
    res = video_editor.render_clip(
        source_video_path=sample_video,
        start_sec=0.0,
        end_sec=3.0,
        output_path=out_path,
        editing_format="FULL_SCREEN",
        burn_subtitles=False
    )
    assert os.path.exists(out_path)
    assert os.path.exists(res["thumbnailPath"])

    # Quality check
    qc = quality_checker.inspect_and_validate(
        video_path=out_path,
        expected_min_duration=2.5,
        expected_max_duration=4.0,
        expected_width=1080,
        expected_height=1920
    )
    assert qc["isValid"] is True
    assert qc["qualityScore"] >= 80.0
    assert qc["details"]["width"] == 1080
    assert qc["details"]["height"] == 1920
    assert qc["details"]["is9to16"] is True

def test_render_clip_split_screen(sample_video):
    out_path = str(TEST_DIR / "test_out_splitscreen.mp4")
    res = video_editor.render_clip(
        source_video_path=sample_video,
        start_sec=0.0,
        end_sec=3.0,
        output_path=out_path,
        editing_format="SPLIT_SCREEN",
        split_ratio=0.5,
        burn_subtitles=False
    )
    assert os.path.exists(out_path)

    qc = quality_checker.inspect_and_validate(
        video_path=out_path,
        expected_min_duration=2.5,
        expected_max_duration=4.0,
        expected_width=1080,
        expected_height=1920
    )
    assert qc["isValid"] is True
    assert qc["qualityScore"] >= 80.0
    assert qc["details"]["width"] == 1080
    assert qc["details"]["height"] == 1920
