"""
Alert manager.

Tracks the continuous duration of each distraction event and emits alert
dictionaries once the configured threshold has been exceeded.

Each alert dict:
    {
        "type":     str   – event identifier
        "message":  str   – text to display on screen
        "duration": float – how long the event has been active (seconds)
        "new_log":  bool  – True on the first frame the threshold is crossed
                            (use this to write exactly one log entry)
    }
"""
import time
from config import Config


class AlertManager:
    _EVENTS = [
        "EYES_CLOSED",
        "DROWSY",           # PERCLOS-based drowsiness (sustained, scientific)
        "GAZE_LEFT",
        "GAZE_RIGHT",
        "GAZE_DOWN",
        "PHONE_DETECTED",
        "SEATBELT_OFF",     # seatbelt not detected
        "NO_FACE",
    ]

    _THRESHOLDS = {
        "EYES_CLOSED":    Config.EYE_CLOSED_ALERT_SECS,
        "DROWSY":         Config.DROWSY_ALERT_SECS,
        "GAZE_LEFT":      Config.GAZE_AWAY_ALERT_SECS,
        "GAZE_RIGHT":     Config.GAZE_AWAY_ALERT_SECS,
        "GAZE_DOWN":      Config.LOOK_DOWN_ALERT_SECS,
        "PHONE_DETECTED": Config.PHONE_ALERT_SECS,
        "SEATBELT_OFF":   Config.SEATBELT_OFF_ALERT_SECS,
        "NO_FACE":        Config.NO_FACE_ALERT_SECS,
    }

    _MESSAGES = {
        "EYES_CLOSED":    "Warning: Eyes closed!",
        "DROWSY":         "Warning: Driver drowsy (PERCLOS)!",
        "GAZE_LEFT":      "Warning: Looking away (left)!",
        "GAZE_RIGHT":     "Warning: Looking away (right)!",
        "GAZE_DOWN":      "Warning: Looking down!",
        "PHONE_DETECTED": "Warning: Possible phone usage!",
        "SEATBELT_OFF":   "Warning: Seatbelt not detected!",
        "NO_FACE":        "Warning: Driver not detected!",
    }

    def __init__(self):
        # start time of the current uninterrupted event; None = not active
        self._start: dict[str, float | None] = {k: None for k in self._EVENTS}
        # whether the threshold was already crossed in this continuous episode
        self._logged: dict[str, bool] = {k: False for k in self._EVENTS}

    # ── public API ────────────────────────────────────────────────────────────

    def update(
        self,
        face_detected:   bool,
        eyes_closed:     bool,
        gaze:            str,
        phone_near:      bool,
        now:             float,
        perclos_drowsy:  bool = False,
        seatbelt_on:     bool = True,
    ) -> list[dict]:
        """
        Call once per frame.  Returns a list of currently active alert dicts.

        New parameters:
            perclos_drowsy – True when PERCLOS >= PERCLOS_DROWSY_THRESHOLD
            seatbelt_on    – False when no seatbelt strap detected
        """
        conditions = {
            "EYES_CLOSED":    face_detected and eyes_closed,
            "DROWSY":         face_detected and perclos_drowsy,
            "GAZE_LEFT":      face_detected and gaze == "left",
            "GAZE_RIGHT":     face_detected and gaze == "right",
            "GAZE_DOWN":      face_detected and gaze == "down",
            "PHONE_DETECTED": phone_near,
            "SEATBELT_OFF":   not seatbelt_on,
            "NO_FACE":        not face_detected,
        }

        alerts = []
        for event, active in conditions.items():
            if active:
                if self._start[event] is None:
                    self._start[event]  = now
                    self._logged[event] = False

                duration = now - self._start[event]
                if duration >= self._THRESHOLDS[event]:
                    new_log = not self._logged[event]
                    if new_log:
                        self._logged[event] = True
                    alerts.append({
                        "type":     event,
                        "message":  self._MESSAGES[event],
                        "duration": duration,
                        "new_log":  new_log,
                    })
            else:
                self._start[event]  = None
                self._logged[event] = False

        return alerts

    def active_event_duration(self, event: str) -> float:
        """Return how long an event has been continuously active (0 if inactive)."""
        if self._start.get(event) is None:
            return 0.0
        return time.time() - self._start[event]
