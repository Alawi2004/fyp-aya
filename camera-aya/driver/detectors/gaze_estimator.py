"""
Head-pose / gaze estimation using cv2.solvePnP on six MediaPipe Face Mesh
landmarks mapped to a generic 3-D head model.

Outputs one of: "forward" | "left" | "right" | "down" | "up" | "unknown"

Tuning note
-----------
The yaw / pitch thresholds in config.py may need small adjustments depending
on camera angle and the individual driver.  Run with SHOW_ANGLES=True to
display the live numeric values and decide on your own thresholds.
"""
import numpy as np
import cv2
from config import Config

SHOW_ANGLES = False   # set True to overlay raw pitch/yaw for calibration

# Six landmark indices used for pose estimation
POSE_LM = [1, 152, 33, 263, 61, 291]
#           nose-tip, chin, r-eye-outer, l-eye-outer, r-mouth, l-mouth

# Corresponding generic 3-D head model (mm, right-hand, Y-up)
FACE_3D = np.array([
    [  0.0,    0.0,    0.0],   # 1   nose tip
    [  0.0, -330.0,  -65.0],   # 152 chin
    [-225.0,  170.0, -135.0],  # 33  right-eye outer (camera left)
    [ 225.0,  170.0, -135.0],  # 263 left-eye outer  (camera right)
    [-150.0, -150.0, -125.0],  # 61  right mouth corner
    [ 150.0, -150.0, -125.0],  # 291 left mouth corner
], dtype=np.float64)

# Zero distortion assumption (acceptable for webcam at typical driver distance)
DIST_COEFFS = np.zeros((4, 1), dtype=np.float64)


class GazeEstimator:

    def estimate(self, landmarks, w, h, frame):
        """
        Estimate gaze direction from face landmarks.
        Returns direction string and (optionally) draws debug info.
        """
        face_2d = np.array(
            [(landmarks.landmark[i].x * w, landmarks.landmark[i].y * h)
             for i in POSE_LM],
            dtype=np.float64,
        )

        focal = w  # approximation: focal length ≈ image width
        cam_matrix = np.array(
            [[focal, 0, w / 2],
             [0, focal, h / 2],
             [0,     0,     1]],
            dtype=np.float64,
        )

        ok, rvec, _ = cv2.solvePnP(
            FACE_3D, face_2d, cam_matrix, DIST_COEFFS,
            flags=cv2.SOLVEPNP_ITERATIVE,
        )
        if not ok:
            return "unknown"

        rmat, _ = cv2.Rodrigues(rvec)
        angles, *_ = cv2.RQDecomp3x3(rmat)
        # RQDecomp3x3 returns degrees; multiply by 360 gives a stable
        # scaled signal that mirrors what most published tutorials use.
        pitch = angles[0] * 360
        yaw   = angles[1] * 360

        if SHOW_ANGLES:
            cv2.putText(
                frame,
                f"pitch={pitch:.1f}  yaw={yaw:.1f}",
                (10, h - 20),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 0), 1,
            )

        return self._classify(pitch, yaw)

    @staticmethod
    def _classify(pitch, yaw):
        if pitch < -Config.GAZE_PITCH_DOWN_THRESHOLD:
            return "down"
        if pitch >  Config.GAZE_PITCH_UP_THRESHOLD:
            return "up"
        if yaw   >  Config.GAZE_YAW_THRESHOLD:
            return "left"
        if yaw   < -Config.GAZE_YAW_THRESHOLD:
            return "right"
        return "forward"
