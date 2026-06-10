"""
Face detection using MediaPipe FaceLandmarker (Tasks API).
Compatible with mediapipe >= 0.10.14 (Python 3.13 / no mp.solutions).

Returns a shim object whose shape matches the old FaceMesh API so that
eye_detector.py and gaze_estimator.py need no changes:
  result.multi_face_landmarks       -> list (empty if no face)
  result.multi_face_landmarks[0]    -> shim with .landmark list
  result.multi_face_landmarks[0].landmark[i].x / .y / .z
"""
import os
import urllib.request
import cv2
import mediapipe as mp

_MODELS_DIR = os.path.dirname(os.path.abspath(__file__))
_FACE_MODEL = os.path.join(_MODELS_DIR, "face_landmarker.task")
_FACE_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "face_landmarker/face_landmarker/float16/1/face_landmarker.task"
)


def _ensure_model(path, url):
    if not os.path.isfile(path):
        print(f"[FaceDetector] Downloading model → {os.path.basename(path)} …")
        urllib.request.urlretrieve(url, path)
        print(f"[FaceDetector] Model saved to {path}")


# ── Compatibility shims (mimic old mp.solutions.face_mesh result shape) ───────

class _Lm:
    __slots__ = ("x", "y", "z")
    def __init__(self, x, y, z):
        self.x, self.y, self.z = x, y, z

class _LmList:
    __slots__ = ("landmark",)
    def __init__(self, lms):
        self.landmark = [_Lm(lm.x, lm.y, lm.z) for lm in lms]

class _FaceResult:
    __slots__ = ("multi_face_landmarks",)
    def __init__(self, face_landmarks):
        self.multi_face_landmarks = [_LmList(fl) for fl in face_landmarks] if face_landmarks else []


# ── Detector ──────────────────────────────────────────────────────────────────

class FaceDetector:
    def __init__(self):
        _ensure_model(_FACE_MODEL, _FACE_MODEL_URL)
        options = mp.tasks.vision.FaceLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=_FACE_MODEL),
            output_face_blendshapes=False,
            output_facial_transformation_matrixes=False,
            num_faces=1,
            min_face_detection_confidence=0.5,
            min_face_presence_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        self._detector = mp.tasks.vision.FaceLandmarker.create_from_options(options)

    def detect(self, bgr_frame):
        """Return a shim compatible with the old FaceMesh results API."""
        rgb = cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = self._detector.detect(mp_image)
        return _FaceResult(result.face_landmarks)

    def get_face_box(self, landmarks, w, h, padding=0.10):
        xs = [lm.x for lm in landmarks.landmark]
        ys = [lm.y for lm in landmarks.landmark]
        pad_x = (max(xs) - min(xs)) * padding
        pad_y = (max(ys) - min(ys)) * padding
        x1 = max(0, int((min(xs) - pad_x) * w))
        y1 = max(0, int((min(ys) - pad_y) * h))
        x2 = min(w, int((max(xs) + pad_x) * w))
        y2 = min(h, int((max(ys) + pad_y) * h))
        return x1, y1, x2, y2

    def close(self):
        self._detector.close()
