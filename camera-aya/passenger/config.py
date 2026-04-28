class Config:
    # ── Camera ────────────────────────────────────────────────────────────────
    CAMERA_INDEX  = 0
    FRAME_WIDTH   = 1280
    FRAME_HEIGHT  = 720

    # ── YOLO / detection ──────────────────────────────────────────────────────
    YOLO_MODEL       = "yolov8n.pt"
    PERSON_CLASS_ID  = 0
    DETECTION_CONF   = 0.50

    # ── Tracking ──────────────────────────────────────────────────────────────
    TRACKER = "bytetrack.yaml"

    # ── Two-line counting zone ─────────────────────────────────────────────────
    #
    # WHY two lines instead of one?
    # ──────────────────────────────
    # A single line creates two problems:
    #   1. A person who hesitates exactly on the line gets counted twice.
    #   2. Brief tracker loss near the line causes a false count on reacquisition.
    #
    # Two lines create a ZONE.  A count only triggers when the centroid
    # travels all the way through the zone:
    #   ENTRY : OUTSIDE  →  crosses Line A  →  ZONE  →  crosses Line B  →  INSIDE
    #   EXIT  : INSIDE   →  crosses Line B  →  ZONE  →  crosses Line A  →  OUTSIDE
    #
    # Backing out or hesitating inside the zone does NOT trigger a count.
    # This matches how commercial bus-door counters (Iris, Dilax) work.
    #
    # ── Orientation ────────────────────────────────────────────────────────────
    # Camera is mounted on the wall BESIDE the bus door, looking across the
    # door opening.  People walk LEFT ↔ RIGHT through the frame.
    # → Use VERTICAL lines (they run top-to-bottom across the frame).
    #
    # If camera is mounted ABOVE the door looking straight DOWN, people walk
    # toward/away from the aisle in the frame → use "horizontal".
    #
    LINE_ORIENTATION = "vertical"   # "vertical" | "horizontal"

    # Positions as a fraction of frame WIDTH  (vertical lines)
    #                          or frame HEIGHT (horizontal lines).
    # LINE_A = outer line (first one a boarding passenger crosses)
    # LINE_B = inner line (completing the crossing triggers the count)
    #
    #  Frame layout for ENTRY_DIRECTION = "left_to_right":
    #
    #   0 %      35 %          65 %       100 %
    #   |         |             |          |
    #   | OUTSIDE | ← DOOR ZONE→|  INSIDE  |
    #   |         |  Line A  Line B        |
    #
    LINE_A_POSITION  = 0.35   # outer line at 35 % of frame width
    LINE_B_POSITION  = 0.65   # inner line at 65 % of frame width

    # Which direction means "boarding the bus":
    #   "left_to_right"  – outside is on the LEFT  (most side-cam setups)
    #   "right_to_left"  – outside is on the RIGHT
    #   "top_to_bottom"  – outside is at the TOP   (overhead camera, enter from outside/steps)
    #   "bottom_to_top"  – outside is at the BOTTOM
    ENTRY_DIRECTION  = "left_to_right"

    # Flash duration (seconds) after a confirmed crossing
    LINE_FLASH_SECS  = 0.7

    # ── Bus capacity ──────────────────────────────────────────────────────────
    BUS_CAPACITY = 50

    # ── Persistence ───────────────────────────────────────────────────────────
    DB_FILE  = "logs/passenger_data.db"
    LOG_FILE = "logs/passenger_log.csv"

    # ── Live JSON export ──────────────────────────────────────────────────────
    EXPORT_JSON            = "logs/live_data.json"
    EXPORT_INTERVAL_SECS   = 5
    SNAPSHOT_INTERVAL_SECS = 30

    # ── Optional Flask API ────────────────────────────────────────────────────
    API_HOST = "0.0.0.0"
    API_PORT = 5050
