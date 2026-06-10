"""
All HUD / overlay drawing for the bus passenger counter.

Visual design
─────────────
  Two VERTICAL lines divide the frame into three zones:

      OUTSIDE  │ Line A │←  DOOR ZONE  →│ Line B │  INSIDE
       (blue)  │        │   (amber bg)  │        │  (green)

  Person bounding boxes are coloured by their current zone:
      OUTSIDE → blue    (person has not started crossing)
      ZONE    → amber   (person is mid-crossing — attention!)
      INSIDE  → green   (person is confirmed on the bus)

  On a confirmed crossing the matching line flashes and the zone label
  changes.  A large ENTRY / EXIT overlay appears for LINE_FLASH_SECS.

  Right panel  – counters + occupancy bar
  Bottom strip – last 6 events log
"""
import cv2
import numpy as np
from config import Config

_FONT   = cv2.FONT_HERSHEY_SIMPLEX
_FONT_B = cv2.FONT_HERSHEY_DUPLEX

# Palette
_WHITE    = (255, 255, 255)
_BLACK    = (0,   0,   0)
_GREEN    = (40,  200,  40)
_RED      = (40,   40, 210)
_AMBER    = (30,  180, 220)
_BLUE_BOX = (200, 100,  40)
_CYAN     = (200, 200,   0)
_DARK     = (20,  20,   20)
_PANEL_BG = (15,  15,   35)
_ORANGE   = (0,   140, 255)

# Zone background tints (BGR)
_TINT_OUTSIDE = (60,  40,   0)    # dark blue
_TINT_ZONE    = (0,   60,  80)    # dark amber
_TINT_INSIDE  = (0,   50,   0)    # dark green

# Box colours per zone
_BOX_OUTSIDE = (200,  80,  40)    # blue-ish
_BOX_ZONE    = ( 30, 200, 220)    # amber
_BOX_INSIDE  = ( 40, 210,  40)    # green


def _blend_rect(frame, x1, y1, x2, y2, colour, alpha=0.35):
    overlay = frame.copy()
    cv2.rectangle(overlay, (x1, y1), (x2, y2), colour, -1)
    cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)


# ── zone backgrounds ──────────────────────────────────────────────────────────

def draw_zone_backgrounds(frame, line_counter):
    """Tint the three regions so the zone is immediately visible."""
    h, w = frame.shape[:2]
    la, lb = line_counter.line_a, line_counter.line_b

    if Config.LINE_ORIENTATION == "vertical":
        if Config.ENTRY_DIRECTION in ("left_to_right",):
            _blend_rect(frame, 0,  0, la, h, _TINT_OUTSIDE, 0.30)
            _blend_rect(frame, la, 0, lb, h, _TINT_ZONE,    0.30)
            _blend_rect(frame, lb, 0, w,  h, _TINT_INSIDE,  0.30)
        else:  # right_to_left
            _blend_rect(frame, lb, 0, w,  h, _TINT_OUTSIDE, 0.30)
            _blend_rect(frame, la, 0, lb, h, _TINT_ZONE,    0.30)
            _blend_rect(frame, 0,  0, la, h, _TINT_INSIDE,  0.30)
    else:  # horizontal
        if Config.ENTRY_DIRECTION == "top_to_bottom":
            _blend_rect(frame, 0, 0,  w, la, _TINT_OUTSIDE, 0.30)
            _blend_rect(frame, 0, la, w, lb, _TINT_ZONE,    0.30)
            _blend_rect(frame, 0, lb, w, h,  _TINT_INSIDE,  0.30)
        else:
            _blend_rect(frame, 0, lb, w, h,  _TINT_OUTSIDE, 0.30)
            _blend_rect(frame, 0, la, w, lb, _TINT_ZONE,    0.30)
            _blend_rect(frame, 0, 0,  w, la, _TINT_INSIDE,  0.30)


# ── counting lines ────────────────────────────────────────────────────────────

def draw_counting_lines(frame, line_counter, now: float):
    h, w = frame.shape[:2]
    la, lb = line_counter.line_a, line_counter.line_b

    elapsed  = now - line_counter.last_event_time
    flashing = elapsed < Config.LINE_FLASH_SECS and line_counter.last_event

    if flashing:
        flash_col = _GREEN if line_counter.last_event == "entry" else _RED
        line_col_a = flash_col
        line_col_b = flash_col
        thickness  = 4
    else:
        line_col_a = (160, 160, 160)   # neutral grey
        line_col_b = (160, 160, 160)
        thickness  = 2

    if Config.LINE_ORIENTATION == "vertical":
        cv2.line(frame, (la, 0), (la, h), line_col_a, thickness)
        cv2.line(frame, (lb, 0), (lb, h), line_col_b, thickness)

        # Labels on the lines
        cv2.putText(frame, "A", (la + 4, 20), _FONT, 0.55, line_col_a, 2)
        cv2.putText(frame, "B", (lb + 4, 20), _FONT, 0.55, line_col_b, 2)

        # Zone sections labels
        _draw_zone_labels_vertical(frame, la, lb, h, w)

        # Entry / exit direction arrows
        mid_y = h // 2
        zone_cx = (la + lb) // 2
        cv2.arrowedLine(frame, (la - 30, mid_y), (lb + 30, mid_y),
                        _GREEN, 2, tipLength=0.25)
        cv2.putText(frame, "ENTRY", (zone_cx - 28, mid_y - 8),
                    _FONT, 0.42, _GREEN, 1)
        cv2.arrowedLine(frame, (lb + 30, mid_y + 30), (la - 30, mid_y + 30),
                        _RED, 2, tipLength=0.25)
        cv2.putText(frame, "EXIT", (zone_cx - 20, mid_y + 24),
                    _FONT, 0.42, _RED, 1)
    else:
        cv2.line(frame, (0, la), (w, la), line_col_a, thickness)
        cv2.line(frame, (0, lb), (w, lb), line_col_b, thickness)
        cv2.putText(frame, "A", (8, la - 6), _FONT, 0.55, line_col_a, 2)
        cv2.putText(frame, "B", (8, lb - 6), _FONT, 0.55, line_col_b, 2)
        _draw_zone_labels_horizontal(frame, la, lb, h, w)


def _draw_zone_labels_vertical(frame, la, lb, h, w):
    cy = h - 22
    d  = Config.ENTRY_DIRECTION

    outside_x = (0  + la) // 2
    zone_x    = (la + lb) // 2
    inside_x  = (lb + w)  // 2

    if d == "right_to_left":
        outside_x, inside_x = inside_x, outside_x

    for text, cx, col in [
        ("OUTSIDE", outside_x, _BLUE_BOX),
        ("DOOR ZONE", zone_x,  _AMBER),
        ("INSIDE",  inside_x,  _GREEN),
    ]:
        (tw, _), _ = cv2.getTextSize(text, _FONT, 0.55, 1)
        cv2.putText(frame, text, (cx - tw // 2, cy), _FONT, 0.55, col, 2)


def _draw_zone_labels_horizontal(frame, la, lb, h, w):
    cx = w - 90
    d  = Config.ENTRY_DIRECTION
    outside_y = (0  + la) // 2
    zone_y    = (la + lb) // 2
    inside_y  = (lb + h)  // 2
    if d == "bottom_to_top":
        outside_y, inside_y = inside_y, outside_y
    for text, cy, col in [
        ("OUTSIDE",   outside_y, _BLUE_BOX),
        ("DOOR ZONE", zone_y,    _AMBER),
        ("INSIDE",    inside_y,  _GREEN),
    ]:
        cv2.putText(frame, text, (cx, cy), _FONT, 0.50, col, 2)


# ── person bounding boxes ─────────────────────────────────────────────────────

def draw_tracks(frame, tracks, line_counter):
    for (track_id, x1, y1, x2, y2, _conf) in tracks:
        cx = (x1 + x2) // 2
        cy = (y1 + y2) // 2
        region = line_counter.get_region(cx, cy)

        colour = {
            "outside": _BOX_OUTSIDE,
            "zone":    _BOX_ZONE,
            "inside":  _BOX_INSIDE,
        }.get(region, _WHITE)

        # Box
        cv2.rectangle(frame, (x1, y1), (x2, y2), colour, 2)
        # Centroid
        cv2.circle(frame, (cx, cy), 5, colour, -1)

        # Label badge
        label = f"#{track_id}  {region}"
        (tw, th), _ = cv2.getTextSize(label, _FONT, 0.45, 1)
        cv2.rectangle(frame, (x1, y1 - th - 8), (x1 + tw + 6, y1), colour, -1)
        cv2.putText(frame, label, (x1 + 3, y1 - 4), _FONT, 0.45, _BLACK, 1)


# ── flash overlay ─────────────────────────────────────────────────────────────

def draw_crossing_flash(frame, line_counter, now: float):
    elapsed = now - line_counter.last_event_time
    if elapsed > Config.LINE_FLASH_SECS * 0.5 or line_counter.last_event is None:
        return
    tint = (0, 60, 0) if line_counter.last_event == "entry" else (0, 0, 60)
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (frame.shape[1], frame.shape[0]), tint, -1)
    cv2.addWeighted(overlay, 0.20, frame, 0.80, 0, frame)

    msg = "ENTRY" if line_counter.last_event == "entry" else "EXIT"
    col = _GREEN  if line_counter.last_event == "entry" else _RED
    fh, fw = frame.shape[:2]
    (tw, th), _ = cv2.getTextSize(msg, _FONT_B, 2.2, 4)
    cv2.putText(frame, msg, ((fw - tw) // 2, fh // 2 + th // 2),
                _FONT_B, 2.2, col, 4)


# ── stats panel ───────────────────────────────────────────────────────────────

def draw_stats_panel(frame, line_counter, fps: float, _now: float):
    h, w = frame.shape[:2]
    panel_w = 235
    panel_h = 290
    px      = w - panel_w - 5
    _blend_rect(frame, px, 5, px + panel_w, 5 + panel_h, _PANEL_BG, 0.75)

    entries = line_counter.total_entries
    exits   = line_counter.total_exits
    on_bus  = line_counter.current_count
    cap     = Config.BUS_CAPACITY
    occ     = min(on_bus / max(cap, 1), 1.0)

    def row(label, value, colour, y_off):
        y = 34 + y_off
        cv2.putText(frame, label,      (px + 8,   y), _FONT,   0.52, _WHITE,  1)
        cv2.putText(frame, str(value), (px + 168, y), _FONT_B, 0.58, colour,  1)

    cv2.putText(frame, "BUS COUNTER", (px + 18, 24), _FONT_B, 0.60, _CYAN, 1)
    row("Entered  :", entries, _GREEN,   18)
    row("Exited   :", exits,   _RED,     46)
    row("On Bus   :", on_bus,  _WHITE,   74)
    row("Capacity :", cap,     (180,180,180), 102)

    # Occupancy bar
    bx, by, bw, bh = px + 8, 155, panel_w - 16, 18
    filled = int(bw * occ)
    bar_col = _RED if occ > 0.85 else (_ORANGE if occ > 0.65 else _GREEN)
    cv2.rectangle(frame, (bx, by), (bx + bw, by + bh), (55, 55, 55), -1)
    if filled:
        cv2.rectangle(frame, (bx, by), (bx + filled, by + bh), bar_col, -1)
    cv2.putText(frame, f"{int(occ * 100)} % full",
                (bx, by + bh + 18), _FONT, 0.46, bar_col, 1)

    if on_bus >= cap:
        cv2.putText(frame, "!! BUS FULL !!",
                    (px + 18, by + bh + 46), _FONT_B, 0.72, _RED, 2)

    cv2.putText(frame, f"FPS {fps:.1f}",
                (px + 8, 5 + panel_h - 8), _FONT, 0.42, (110, 110, 110), 1)


# ── recent events ─────────────────────────────────────────────────────────────

def draw_recent_events(frame, recent_events: list[dict]):
    if not recent_events:
        return
    h, w    = frame.shape[:2]
    panel_w = 310
    row_h   = 20
    n       = min(len(recent_events), 6)
    panel_h = row_h * n + 18
    x0      = 5
    y0      = h - panel_h - 5
    _blend_rect(frame, x0, y0, x0 + panel_w, y0 + panel_h, _DARK, 0.60)
    cv2.putText(frame, "Recent crossings", (x0 + 6, y0 + 14),
                _FONT, 0.42, (140, 140, 140), 1)
    for i, ev in enumerate(recent_events[:n]):
        col   = _GREEN if ev["type"] == "entry" else _RED
        label = (f"{ev['time']}  "
                 f"{'ENTRY' if ev['type'] == 'entry' else 'EXIT ':5s}  "
                 f"ID #{ev['track_id']:3d}  "
                 f"[{ev['count']} on bus]")
        cv2.putText(frame, label,
                    (x0 + 6, y0 + 16 + (i + 1) * row_h),
                    _FONT, 0.40, col, 1)
