"""
Two-line zone counter.

State machine per track ID
──────────────────────────
Each tracked person is always in one of three regions:

    OUTSIDE  │ Line A │   ZONE   │ Line B │  INSIDE
             ←────────── door opening ──────────→

States:
    OUTSIDE  – person is fully outside the bus (street / steps side)
    ZONE     – person is between the two lines (actively crossing the door)
    INSIDE   – person is fully inside the bus (aisle side)

Counting rules:
    ENTRY counted when:  ZONE → INSIDE   (completed walking in)
    EXIT  counted when:  ZONE → OUTSIDE  (completed walking out)

Transitions that do NOT count:
    OUTSIDE → ZONE         (started entering — wait for confirmation)
    ZONE    → OUTSIDE      (backed out before fully entering — no count)
    INSIDE  → ZONE         (started exiting — wait for confirmation)
    ZONE    → INSIDE       (backed in before fully exiting — no count)
    OUTSIDE → INSIDE       (teleport / tracker skip — ignored for safety)
    INSIDE  → OUTSIDE      (teleport / tracker skip — ignored for safety)

This eliminates the need for time-based debounce hacks.  The zone itself
acts as a physical buffer: a person must travel its full width before a
count is triggered.

First appearance
────────────────
    cx < line_a              → OUTSIDE  (person just appeared outside)
    line_a ≤ cx ≤ line_b     → ZONE     (mid-crossing; count triggers on
                                          whichever line they cross next)
    cx > line_b              → INSIDE   (person already on bus; no entry counted)

The "first in ZONE" case is safe: if they were already mid-crossing when
the tracker first saw them, counting when they exit the zone on either side
is the correct behaviour.
"""
from config import Config

_OUTSIDE = "outside"
_ZONE    = "zone"
_INSIDE  = "inside"


class LineCounter:

    def __init__(self, frame_w: int, frame_h: int):
        orient = Config.LINE_ORIENTATION
        direction = Config.ENTRY_DIRECTION

        if orient == "vertical":
            raw_a = int(Config.LINE_A_POSITION * frame_w)
            raw_b = int(Config.LINE_B_POSITION * frame_w)
        else:  # horizontal
            raw_a = int(Config.LINE_A_POSITION * frame_h)
            raw_b = int(Config.LINE_B_POSITION * frame_h)

        # For directions where "outside" is on the high-coordinate side,
        # swap so that line_a is always the OUTER line and line_b the INNER.
        if direction in ("left_to_right", "top_to_bottom"):
            self.line_a = raw_a   # outer (smaller coord)
            self.line_b = raw_b   # inner (larger coord)
        else:
            self.line_a = raw_b   # outer (larger coord — further from inside)
            self.line_b = raw_a   # inner (smaller coord)

        self._direction = direction
        self._orient    = orient

        # State per track ID
        self._state: dict[int, str] = {}

        self.total_entries  = 0
        self.total_exits    = 0

        # Flash state consumed by drawing module
        self.last_event      = None
        self.last_event_time = 0.0
        self.last_event_id   = None

    # ── public ────────────────────────────────────────────────────────────────

    @property
    def current_count(self) -> int:
        return max(0, self.total_entries - self.total_exits)

    def get_region(self, cx: int, cy: int) -> str:
        """Return which region a centroid is currently in."""
        coord = cx if self._orient == "vertical" else cy
        return self._coord_to_region(coord)

    def update(self, track_id: int, cx: int, cy: int, now: float) -> str | None:
        """
        Process one tracked person's centroid.
        Returns "entry", "exit", or None.
        """
        coord  = cx if self._orient == "vertical" else cy
        region = self._coord_to_region(coord)

        if track_id not in self._state:
            self._state[track_id] = region
            return None

        prev   = self._state[track_id]
        self._state[track_id] = region

        if prev == region:
            return None

        event = self._classify_transition(prev, region)

        if event == "entry":
            self.total_entries  += 1
            self.last_event      = "entry"
            self.last_event_time = now
            self.last_event_id   = track_id
        elif event == "exit":
            self.total_exits    += 1
            self.last_event      = "exit"
            self.last_event_time = now
            self.last_event_id   = track_id

        return event

    def cleanup_stale_tracks(self, active_ids: list[int]):
        active = set(active_ids)
        for tid in list(self._state.keys()):
            if tid not in active:
                del self._state[tid]

    def reset(self):
        self.total_entries   = 0
        self.total_exits     = 0
        self._state.clear()
        self.last_event      = None
        self.last_event_time = 0.0
        self.last_event_id   = None

    # ── private ───────────────────────────────────────────────────────────────

    def _coord_to_region(self, coord: int) -> str:
        """Map a raw pixel coordinate to OUTSIDE / ZONE / INSIDE."""
        d = self._direction
        if d in ("left_to_right", "top_to_bottom"):
            # line_a < line_b; smaller coord = outside
            if coord < self.line_a:
                return _OUTSIDE
            if coord <= self.line_b:
                return _ZONE
            return _INSIDE
        else:
            # line_a > line_b; larger coord = outside
            if coord > self.line_a:
                return _OUTSIDE
            if coord >= self.line_b:
                return _ZONE
            return _INSIDE

    @staticmethod
    def _classify_transition(prev: str, curr: str) -> str | None:
        """
        Apply the state-machine rules and return the event type, or None.

        Only ZONE→INSIDE and ZONE→OUTSIDE are valid counting transitions.
        Every other transition (including OUTSIDE↔INSIDE skips) is ignored.
        """
        if prev == _ZONE and curr == _INSIDE:
            return "entry"
        if prev == _ZONE and curr == _OUTSIDE:
            return "exit"
        return None
