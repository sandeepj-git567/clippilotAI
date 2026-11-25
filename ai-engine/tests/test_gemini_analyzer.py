import pytest
from services.gemini_analyzer import gemini_analyzer

def test_heuristic_moment_extractor():
    sample_transcript = {
        "language": "en",
        "duration": 60.0,
        "segments": [
            {
                "segmentIndex": 0,
                "startSec": 0.0,
                "endSec": 4.5,
                "text": "Wait, can I keep him? Hey buddy, come here!",
                "words": [
                    {"word": "Wait", "start": 0.0, "end": 0.5},
                    {"word": "can", "start": 0.5, "end": 0.8},
                    {"word": "I", "start": 0.8, "end": 1.0},
                    {"word": "keep", "start": 1.0, "end": 1.4},
                    {"word": "him?", "start": 1.4, "end": 1.9},
                    {"word": "Hey", "start": 2.2, "end": 2.6},
                    {"word": "buddy,", "start": 2.6, "end": 3.1},
                    {"word": "come", "start": 3.2, "end": 3.6},
                    {"word": "here!", "start": 3.6, "end": 4.5}
                ]
            },
            {
                "segmentIndex": 1,
                "startSec": 5.0,
                "endSec": 10.5,
                "text": "This player casually drives along as a plane crashes in a distance. Oh my god!",
                "words": [
                    {"word": "This", "start": 5.0, "end": 5.3},
                    {"word": "player", "start": 5.3, "end": 5.8},
                    {"word": "casually", "start": 5.8, "end": 6.4},
                    {"word": "drives", "start": 6.4, "end": 6.8},
                    {"word": "along", "start": 6.8, "end": 7.2},
                    {"word": "as", "start": 7.2, "end": 7.4},
                    {"word": "a", "start": 7.4, "end": 7.5},
                    {"word": "plane", "start": 7.5, "end": 8.0},
                    {"word": "crashes", "start": 8.0, "end": 8.6},
                    {"word": "in", "start": 8.6, "end": 8.8},
                    {"word": "a", "start": 8.8, "end": 9.0},
                    {"word": "distance.", "start": 9.0, "end": 9.6},
                    {"word": "Oh", "start": 9.8, "end": 10.0},
                    {"word": "my", "start": 10.0, "end": 10.2},
                    {"word": "god!", "start": 10.2, "end": 10.5}
                ]
            },
            {
                "segmentIndex": 2,
                "startSec": 11.0,
                "endSec": 15.0,
                "text": "That was decent. Oh my god, it's fucking big foot!",
                "words": [
                    {"word": "That", "start": 11.0, "end": 11.3},
                    {"word": "was", "start": 11.3, "end": 11.5},
                    {"word": "decent.", "start": 11.5, "end": 12.0},
                    {"word": "Oh", "start": 12.2, "end": 12.5},
                    {"word": "my", "start": 12.5, "end": 12.7},
                    {"word": "god,", "start": 12.7, "end": 13.0},
                    {"word": "it's", "start": 13.0, "end": 13.2},
                    {"word": "fucking", "start": 13.2, "end": 13.6},
                    {"word": "big", "start": 13.6, "end": 14.0},
                    {"word": "foot!", "start": 14.0, "end": 15.0}
                ]
            },
            {
                "segmentIndex": 3,
                "startSec": 20.0,
                "endSec": 26.0,
                "text": "Something as simple as a bird strike can turn a routine landing into a disaster in GTA 6.",
                "words": [
                    {"word": "Something", "start": 20.0, "end": 20.5},
                    {"word": "as", "start": 20.5, "end": 20.7},
                    {"word": "simple", "start": 20.7, "end": 21.0},
                    {"word": "as", "start": 21.0, "end": 21.2},
                    {"word": "a", "start": 21.2, "end": 21.3},
                    {"word": "bird", "start": 21.3, "end": 21.6},
                    {"word": "strike", "start": 21.6, "end": 22.0},
                    {"word": "can", "start": 22.0, "end": 22.2},
                    {"word": "turn", "start": 22.2, "end": 22.5},
                    {"word": "a", "start": 22.5, "end": 22.6},
                    {"word": "routine", "start": 22.6, "end": 23.0},
                    {"word": "landing", "start": 23.0, "end": 23.5},
                    {"word": "into", "start": 23.5, "end": 23.8},
                    {"word": "a", "start": 23.8, "end": 24.0},
                    {"word": "disaster", "start": 24.0, "end": 24.5},
                    {"word": "in", "start": 24.5, "end": 24.8},
                    {"word": "GTA", "start": 24.8, "end": 25.2},
                    {"word": "6.", "start": 25.2, "end": 26.0}
                ]
            },
            {
                "segmentIndex": 4,
                "startSec": 26.5,
                "endSec": 32.0,
                "text": "Easy I say. Can I just kill a bird in the air? The bird messed me off!",
                "words": []
            }
        ]
    }

    highlights = gemini_analyzer.analyze_transcript_highlights(
        transcript_data=sample_transcript,
        video_metadata={"title": "GTA 6 WTF Moments", "category": "Gaming"},
        preferred_count=2,
        min_duration=10.0,
        max_duration=16.0
    )

    assert len(highlights) == 2, f"Expected 2 highlights, got {len(highlights)}"
    for h in highlights:
        assert "startSec" in h
        assert "endSec" in h
        assert "overallScore" in h
        assert h["overallScore"] >= 60.0
        assert h["durationSec"] >= 8.0
        assert h["durationSec"] <= 18.0
        assert len(h["hook"]) > 0

    # Ensure no overlaps
    h1, h2 = highlights[0], highlights[1]
    assert (h1["endSec"] <= h2["startSec"]) or (h2["endSec"] <= h1["startSec"]), "Highlights must not overlap"

def test_metadata_generator():
    meta = gemini_analyzer.generate_clip_metadata(
        clip_transcript="Wait, can I keep him buddy? Look at that plane crash!",
        source_title="GTA 6 WTF and Funny Moments!",
        creator_name="TestGamer"
    )

    assert "title" in meta
    assert "#Shorts" in meta["title"]
    assert "description" in meta
    assert "hashtags" in meta
    assert len(meta["hashtags"]) >= 4
