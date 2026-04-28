"""
Face detection using MediaPipe Face Mesh.
Returns 468 3-D landmarks for the closest face in the frame.
"""
import cv2
import mediapipe as mp


class FaceDetector:
    def __init__(self):
        self._mp_mesh = mp.solutions.face_mesh
        self.mesh = self._mp_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )

    def detect(self, bgr_frame):
        """Return MediaPipe FaceMesh results (or None if no face found)."""
        rgb = cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2RGB)
        rgb.flags.writeable = False
        results = self.mesh.process(rgb)
        rgb.flags.writeable = True
        return results

    def get_face_box(self, landmarks, w, h, padding=0.10):
        """
        Compute an axis-aligned bounding box around all face landmarks.
        Returns (x1, y1, x2, y2) in pixel coordinates with optional padding.
        """
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
        self.mesh.close()
