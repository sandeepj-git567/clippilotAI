import os
import cv2
import numpy as np
import logging
from typing import Tuple, Dict, Any, List
from config import settings

logger = logging.getLogger("clippilot.smart_cropper")

class SmartCropperService:
    def __init__(self):
        self.face_detector = None
        self.haar_cascade = None
        self._init_face_detector()

    def _init_face_detector(self):
        candidates = [
            os.path.join(os.path.dirname(__file__), "face_detection_yunet.onnx"),
            "/app/services/face_detection_yunet.onnx",
            os.path.join(settings.VIDEO_TEMP_DIR, "yunet.onnx")
        ]
        for c in candidates:
            if os.path.exists(c):
                try:
                    self.face_detector = cv2.FaceDetectorYN.create(
                        model=c,
                        config="",
                        input_size=(320, 320),
                        score_threshold=0.55,
                        nms_threshold=0.3,
                        top_k=5000
                    )
                    logger.info(f"Initialized YuNet AI Face Detector from: {c}")
                    break
                except Exception as e:
                    logger.warning(f"Could not initialize FaceDetectorYN from {c}: {e}")

        # Initialize Haar Cascade as reliable lightweight fallback
        try:
            cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            if os.path.exists(cascade_path):
                self.haar_cascade = cv2.CascadeClassifier(cascade_path)
                logger.info(f"Initialized OpenCV Haar Cascade face detector fallback: {cascade_path}")
        except Exception as e:
            logger.warning(f"Could not initialize Haar Cascade: {e}")

    def _detect_faces(self, frame: np.ndarray, orig_w: int, orig_h: int) -> List[Tuple[float, float, float, float, float]]:
        """
        Detects faces in frame: uses YuNet first, falls back to Haar Cascade.
        Returns list of (x, y, w, h, confidence)
        """
        detected = []
        if self.face_detector is not None:
            try:
                self.face_detector.setInputSize((orig_w, orig_h))
                _, faces = self.face_detector.detect(frame)
                if faces is not None and len(faces) > 0:
                    for f in faces:
                        conf = float(f[-1])
                        if conf >= 0.50:
                            detected.append((float(f[0]), float(f[1]), float(f[2]), float(f[3]), conf))
                    if detected:
                        return detected
            except Exception as e:
                logger.debug(f"YuNet detection error: {e}")

        if self.haar_cascade is not None:
            try:
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                haar_faces = self.haar_cascade.detectMultiScale(
                    gray,
                    scaleFactor=1.1,
                    minNeighbors=4,
                    minSize=(40, 40)
                )
                for (hx, hy, hw, hh) in haar_faces:
                    detected.append((float(hx), float(hy), float(hw), float(hh), 0.85))
            except Exception as e:
                logger.debug(f"Haar Cascade detection error: {e}")

        return detected

    def analyze_crop_window(
        self,
        video_path: str,
        start_sec: float,
        end_sec: float,
        target_aspect_ratio: float = 9.0 / 16.0,
        sample_fps: float = 3.0
    ) -> Dict[str, Any]:
        """
        Samples frames across the clip window [start_sec, end_sec] to detect faces
        and main subjects, calculating the optimal horizontal crop center X.
        Returns crop bounding box parameters for FFmpeg crop filter: crop=w:h:x:y
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            logger.warning(f"Failed to open video for cropping analysis: {video_path}")
            return {"crop_x": 0, "crop_y": 0, "crop_w": 1080, "crop_h": 1920, "centerX_normalized": 0.5}

        orig_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        orig_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

        if orig_w == 0 or orig_h == 0:
            cap.release()
            return {"crop_x": 0, "crop_y": 0, "crop_w": 1080, "crop_h": 1920, "centerX_normalized": 0.5}

        target_w = int(orig_h * target_aspect_ratio)
        target_w = min(target_w, orig_w)
        if target_w % 2 != 0:
            target_w -= 1
        target_h = orig_h
        if target_h % 2 != 0:
            target_h -= 1

        start_frame = int(start_sec * video_fps)
        end_frame = int(end_sec * video_fps)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        end_frame = min(end_frame, total_frames)

        frame_step = max(1, int(video_fps / sample_fps))
        detected_centers_x: List[float] = []

        if self.face_detector is not None:
            self.face_detector.setInputSize((orig_w, orig_h))

        cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
        curr_frame_idx = start_frame

        while curr_frame_idx <= end_frame:
            ret, frame = cap.read()
            if not ret or frame is None:
                break

            found_face = False
            faces = self._detect_faces(frame, orig_w, orig_h)
            if faces:
                largest_face = max(faces, key=lambda f: f[2] * f[3])
                fx, fy, fw, fh, _ = largest_face
                center_x = fx + (fw / 2.0)
                detected_centers_x.append(float(center_x))
                found_face = True

            if not found_face:
                # Saliency centroid fallback
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                grad_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
                grad_y = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
                magnitude = cv2.magnitude(grad_x, grad_y)
                moments = cv2.moments(magnitude)
                if moments["m00"] > 0:
                    centroid_x = moments["m10"] / moments["m00"]
                    detected_centers_x.append(float(centroid_x))
                else:
                    detected_centers_x.append(orig_w / 2.0)

            curr_frame_idx += frame_step
            cap.set(cv2.CAP_PROP_POS_FRAMES, curr_frame_idx)

        cap.release()

        if detected_centers_x:
            avg_center_x = float(np.median(detected_centers_x))
        else:
            avg_center_x = orig_w / 2.0

        crop_x = int(avg_center_x - (target_w / 2.0))
        crop_x = max(0, min(crop_x, orig_w - target_w))
        if crop_x % 2 != 0:
            crop_x -= 1
        crop_x = max(0, crop_x)

        return {
            "orig_w": orig_w,
            "orig_h": orig_h,
            "crop_w": target_w,
            "crop_h": target_h,
            "crop_x": crop_x,
            "crop_y": 0,
            "centerX_normalized": round(avg_center_x / orig_w, 3)
        }

    def detect_facecam_region(
        self,
        video_path: str,
        start_sec: float,
        end_sec: float,
        sample_count: int = 10
    ) -> Dict[str, Any]:
        """
        Intelligently detects streamer facecam overlay in 16:9 gameplay footage.
        Analyzes sampled frames across [start_sec, end_sec], detects faces in perimeter quadrants,
        and tests for temporal position stability (streamer camera remains fixed in one spot).
        Returns facecam bounding box with margin for FFmpeg cropping, or has_facecam: False.
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened() or (self.face_detector is None and self.haar_cascade is None):
            logger.info("Facecam detection: Video capture or face detectors unavailable.")
            return {"has_facecam": False}

        orig_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        orig_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

        if orig_w == 0 or orig_h == 0:
            cap.release()
            return {"has_facecam": False}

        clip_duration = max(1.0, end_sec - start_sec)
        sample_times = [start_sec + (i * clip_duration / (sample_count + 1)) for i in range(1, sample_count + 1)]

        detected_faces = []

        for t in sample_times:
            frame_idx = int(t * video_fps)
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            if not ret or frame is None:
                continue

            try:
                faces = self._detect_faces(frame, orig_w, orig_h)
                for f in faces:
                    fx, fy, fw, fh, conf = f
                    if conf < 0.50:
                        continue

                    cx = fx + (fw / 2.0)
                    cy = fy + (fh / 2.0)

                    # Check if located in outer quadrants
                    quadrant = None
                    if cx < orig_w * 0.45 and cy < orig_h * 0.55:
                        quadrant = "top_left"
                    elif cx > orig_w * 0.55 and cy < orig_h * 0.55:
                        quadrant = "top_right"
                    elif cx < orig_w * 0.45 and cy > orig_h * 0.45:
                        quadrant = "bottom_left"
                    elif cx > orig_w * 0.55 and cy > orig_h * 0.45:
                        quadrant = "bottom_right"

                    if quadrant:
                        detected_faces.append({
                            "quadrant": quadrant,
                            "box": (float(fx), float(fy), float(fw), float(fh)),
                            "center": (float(cx), float(cy)),
                            "conf": conf
                        })
            except Exception as e:
                logger.debug(f"Facecam frame error: {e}")

        cap.release()

        if not detected_faces:
            logger.info("Facecam detection: No perimeter faces detected across sampled frames.")
            return {"has_facecam": False}

        # Group by quadrant
        quadrant_counts = {}
        for df in detected_faces:
            q = df["quadrant"]
            quadrant_counts[q] = quadrant_counts.get(q, 0) + 1

        best_quadrant, count = max(quadrant_counts.items(), key=lambda item: item[1])

        # Require at least 2 distinct detections in the same quadrant
        if count < 2:
            logger.info(f"Facecam detection: Detections too sparse ({count} in {best_quadrant}).")
            return {"has_facecam": False}

        quadrant_faces = [df for df in detected_faces if df["quadrant"] == best_quadrant]
        centers_x = [df["center"][0] for df in quadrant_faces]
        centers_y = [df["center"][1] for df in quadrant_faces]

        std_x = float(np.std(centers_x))
        std_y = float(np.std(centers_y))

        # Stationary facecam check
        if std_x > orig_w * 0.15 or std_y > orig_h * 0.15:
            logger.info(f"Facecam detection: Face position not stable (std_x={std_x:.1f}, std_y={std_y:.1f}).")
            return {"has_facecam": False}

        avg_fx = float(np.median([df["box"][0] for df in quadrant_faces]))
        avg_fy = float(np.median([df["box"][1] for df in quadrant_faces]))
        avg_fw = float(np.median([df["box"][2] for df in quadrant_faces]))
        avg_fh = float(np.median([df["box"][3] for df in quadrant_faces]))

        # Expand box by 45% margin to capture the full streamer webcam window
        pad_x = avg_fw * 0.45
        pad_y = avg_fh * 0.45

        crop_x = int(max(0, avg_fx - pad_x))
        crop_y = int(max(0, avg_fy - pad_y))
        crop_w = int(min(orig_w - crop_x, avg_fw + (2 * pad_x)))
        crop_h = int(min(orig_h - crop_y, avg_fh + (2 * pad_y)))

        if crop_w % 2 != 0:
            crop_w -= 1
        if crop_h % 2 != 0:
            crop_h -= 1

        logger.info(
            f"Facecam successfully detected in {best_quadrant}: crop=({crop_w}x{crop_h} at {crop_x},{crop_y}) "
            f"based on {count} stable detections (std_x={std_x:.1f})."
        )

        return {
            "has_facecam": True,
            "quadrant": best_quadrant,
            "crop_x": crop_x,
            "crop_y": crop_y,
            "crop_w": crop_w,
            "crop_h": crop_h,
            "face_count": count
        }

smart_cropper = SmartCropperService()
