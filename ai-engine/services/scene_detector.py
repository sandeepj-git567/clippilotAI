import logging
from typing import List, Dict, Any
import os

logger = logging.getLogger("clippilot.scene_detector")

class SceneDetectorService:
    def detect_scenes(self, video_path: str, threshold: float = 27.0) -> List[Dict[str, float]]:
        """
        Detects visual scene cuts in a video using PySceneDetect (supporting modern and legacy APIs).
        Returns a list of scenes with startSec and endSec.
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")

        logger.info(f"Detecting scene cuts for: {video_path}")

        try:
            # Modern PySceneDetect API (>=0.6.0)
            from scenedetect import open_video, SceneManager
            from scenedetect.detectors import ContentDetector

            video = open_video(video_path)
            scene_manager = SceneManager()
            scene_manager.add_detector(ContentDetector(threshold=threshold))
            scene_manager.detect_scenes(video, show_progress=False)
            scene_list = scene_manager.get_scene_list()

            results = []
            for scene in scene_list:
                results.append({
                    "startSec": round(scene[0].get_seconds(), 3),
                    "endSec": round(scene[1].get_seconds(), 3),
                    "durationSec": round(scene[1].get_seconds() - scene[0].get_seconds(), 3)
                })

            logger.info(f"Detected {len(results)} visual scenes")
            return results
        except Exception as e:
            logger.warning(f"Modern scene detection failed or fallback: {e}")
            try:
                # Legacy PySceneDetect fallback (<0.6.0)
                from scenedetect import VideoManager, SceneManager
                from scenedetect.detectors import ContentDetector

                video_manager = VideoManager([video_path])
                scene_manager = SceneManager()
                scene_manager.add_detector(ContentDetector(threshold=threshold))
                video_manager.set_downscale_factor(2)
                video_manager.start()
                scene_manager.detect_scenes(frame_source=video_manager)
                scene_list = scene_manager.get_scene_list()

                results = []
                for scene in scene_list:
                    results.append({
                        "startSec": round(scene[0].get_seconds(), 3),
                        "endSec": round(scene[1].get_seconds(), 3),
                        "durationSec": round(scene[1].get_seconds() - scene[0].get_seconds(), 3)
                    })
                video_manager.release()
                return results
            except Exception as legacy_err:
                logger.warning(f"Scene detection skipped: {legacy_err}. Returning empty scene list.")
                return []

scene_detector_service = SceneDetectorService()
