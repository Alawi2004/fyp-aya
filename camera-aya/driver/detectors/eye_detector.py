"""
Eye state detection using Eye Aspect Ratio (EAR) computed from MediaPipe
Face Mesh landmarks.

EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)

When both eyes are open the ratio hovers around 0.25-0.35.
A sustained drop below EAR_THRESHOLD indicates closed / drowsy eyes.
"""
import numpy as np
import cv2
from config import Config

# 6-point EAR landmark indices (MediaPipe Face Mesh)
#   p1=left-corner, p2=upper-left, p3=upper-right,
#   p4=right-corner, p5=lower-right, p6=lower-left
LEFT_EYE_IDX  = [362, 385, 387, 263, 373, 380]
RIGHT_EYE_IDX = [33,  160, 158, 133, 153, 144]

# Full eye contours for visualisation
LEFT_EYE_CONTOUR  = [362, 382, 381, 380, 374, 373, 390, 249,
                     263, 466, 388, 387, 386, 385, 384, 398]
RIGHT_EYE_CONTOUR = [33,  7,   163, 144, 145, 153, 154, 155,
                     133, 173, 157, 158, 159, 160, 161, 246]


class EyeDetector:

    @staticmethod
    def _ear(landmarks, indices, w, h):
        pts = np.array(
            [(landmarks.landmark[i].x * w, landmarks.landmark[i].y * h)
             for i in indices],
            dtype=np.float64,
        )
        A = np.linalg.norm(pts[1] - pts[5])
        B = np.linalg.norm(pts[2] - pts[4])
        C = np.linalg.norm(pts[0] - pts[3])
        return (A + B) / (2.0 * C + 1e-6)

    def compute(self, landmarks, w, h):
        """
        Returns (left_ear, right_ear, avg_ear, eyes_closed).
        eyes_closed is True when the smoothed average drops below threshold.
        """
        left  = self._ear(landmarks, LEFT_EYE_IDX,  w, h)
        right = self._ear(landmarks, RIGHT_EYE_IDX, w, h)
        avg   = (left + right) / 2.0
        return left, right, avg, avg < Config.EAR_THRESHOLD

    def draw(self, frame, landmarks, w, h, eyes_closed: bool):
        colour = (0, 0, 255) if eyes_closed else (0, 255, 0)
        for idx in LEFT_EYE_CONTOUR + RIGHT_EYE_CONTOUR:
            lm = landmarks.landmark[idx]
            cv2.circle(frame, (int(lm.x * w), int(lm.y * h)), 1, colour, -1)
