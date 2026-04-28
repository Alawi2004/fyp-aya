"""
All HUD / overlay drawing helpers.

Layout
------
Top-left     – status panel (face / eyes / gaze / phone)
Top-right    – FPS counter
Centre-top   – alert banner (red, flashing)
Bottom-left  – EAR bar
Bottom-right – last 5 logged events
"""
import cv2
import time
import numpy as np

_FONT       = cv2.FONT_HERSHEY_SIMPLEX
_FONT_BOLD  = cv2.FONT_HERSHEY_DUPLEX
_RED        = (0,   0,   220)
_GREEN      = (0,   210,  0)
_YELLOW     = (0,   200, 220)
_WHITE      = (255, 255, 255)
_DARK       = (30,   30,  30)
_ORANGE     = (0,   140, 255)
_CYAN       = (220, 210,  0)

# Direction arrows (unicode-safe fallback text)
_GAZE_ICON = {
    "forward": "[ FORWARD ]",
    "left":    "[ << LEFT  ]",
    "right":   "[ RIGHT >> ]",
    "down":    "[  v DOWN  ]",
    "up":      "[  ^ UP    ]",
    "unknown": "[  ???     ]",
}


def _semi_rect(frame, x1, y1, x2, y2, colour, alpha=0.45):
    """Blended filled rectangle."""
    overlay = frame.copy()
    cv2.rectangle(overlay, (x1, y1), (x2, y2), colour, -1)
    cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)


def draw_status_panel(frame, face_found, eyes_closed, gaze, phone_near, ear):
    """Top-left status strip."""
    h, w = frame.shape[:2]
    panel_w = 260
    _semi_rect(frame, 0, 0, panel_w, 160, _DARK, 0.55)

    def row(label, value, colour, y):
        cv2.putText(frame, label, (8, y),      _FONT, 0.52, _WHITE,  1)
        cv2.putText(frame, value, (110, y),     _FONT, 0.52, colour,  1)

    row("Face",  "Detected" if face_found else "Not Found",
        _GREEN if face_found else _RED, 25)

    eye_val = f"{'CLOSED' if eyes_closed else 'Open'}  EAR={ear:.2f}"
    row("Eyes",  eye_val, _RED if eyes_closed else _GREEN, 52)

    gaze_col = _GREEN if gaze == "forward" else _YELLOW
    row("Gaze",  _GAZE_ICON.get(gaze, gaze), gaze_col, 79)

    ph_col = _RED if phone_near else _GREEN
    row("Phone", "DETECTED!" if phone_near else "Clear", ph_col, 106)

    # EAR bar
    bar_max = 160
    bar_h   = 10
    from config import Config
    filled = int(min(ear / 0.40, 1.0) * bar_max)
    bar_colour = _RED if ear < Config.EAR_THRESHOLD else _GREEN
    cv2.rectangle(frame, (8, 128), (8 + bar_max, 128 + bar_h), (80, 80, 80), -1)
    cv2.rectangle(frame, (8, 128), (8 + filled,  128 + bar_h), bar_colour,   -1)
    cv2.putText(frame, "EAR", (8, 126), _FONT, 0.38, _WHITE, 1)


def draw_alerts(frame, alerts):
    """Centre-top alert banner – pulses red when active."""
    if not alerts:
        return
    h, w = frame.shape[:2]
    # Combine messages
    messages = [a["message"] for a in alerts]

    banner_h = 42 * len(messages) + 14
    _semi_rect(frame, 0, h // 2 - 60, w, h // 2 - 60 + banner_h, _RED, 0.60)

    for i, msg in enumerate(messages):
        y = h // 2 - 30 + i * 42
        (tw, _), _ = cv2.getTextSize(msg, _FONT_BOLD, 0.85, 2)
        x = (w - tw) // 2
        cv2.putText(frame, msg, (x + 2, y + 2), _FONT_BOLD, 0.85, (0, 0, 0), 3)
        cv2.putText(frame, msg, (x,     y),     _FONT_BOLD, 0.85, _WHITE,    2)


def draw_phone_boxes(frame, boxes):
    for (x1, y1, x2, y2) in boxes:
        cv2.rectangle(frame, (x1, y1), (x2, y2), _RED, 2)
        cv2.putText(frame, "PHONE", (x1, y1 - 6), _FONT, 0.55, _RED, 2)


def draw_gaze_arrow(frame, gaze, face_box):
    """Draw a direction arrow originating from the face centre."""
    if face_box is None or gaze in ("forward", "unknown"):
        return
    fx1, fy1, fx2, fy2 = face_box
    cx = (fx1 + fx2) // 2
    cy = (fy1 + fy2) // 2
    length = 70
    directions = {
        "left":  (-length, 0),
        "right": ( length, 0),
        "down":  (0,  length),
        "up":    (0, -length),
    }
    dx, dy = directions.get(gaze, (0, 0))
    cv2.arrowedLine(frame, (cx, cy), (cx + dx, cy + dy), _ORANGE, 3, tipLength=0.35)


def draw_face_box(frame, face_box, gaze):
    if face_box is None:
        return
    colour = _GREEN if gaze == "forward" else _YELLOW
    x1, y1, x2, y2 = face_box
    cv2.rectangle(frame, (x1, y1), (x2, y2), colour, 2)


def draw_fps(frame, fps):
    h, w = frame.shape[:2]
    label = f"FPS: {fps:.1f}"
    (tw, _), _ = cv2.getTextSize(label, _FONT, 0.6, 1)
    cv2.putText(frame, label, (w - tw - 10, 25), _FONT, 0.6, _CYAN, 1)


def draw_event_log(frame, recent_events):
    """Bottom-right: last N logged events."""
    if not recent_events:
        return
    h, w = frame.shape[:2]
    panel_w = 340
    row_h   = 20
    panel_h = row_h * len(recent_events) + 14
    x0 = w - panel_w - 5
    y0 = h - panel_h - 5
    _semi_rect(frame, x0, y0, w - 5, h - 5, _DARK, 0.5)
    for i, (ts, etype, dur) in enumerate(recent_events):
        label = f"{ts}  {etype}  {dur:.1f}s"
        cv2.putText(frame, label, (x0 + 6, y0 + 16 + i * row_h),
                    _FONT, 0.38, _YELLOW, 1)
