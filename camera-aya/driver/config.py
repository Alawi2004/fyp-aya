class Config:
    # ── Camera ────────────────────────────────────────────────────────────────
    CAMERA_INDEX    = 0
    FRAME_WIDTH     = 1280
    FRAME_HEIGHT    = 720

    # ── Eye-state detection ───────────────────────────────────────────────────
    # Eye Aspect Ratio below this value is considered "eyes closed"
    EAR_THRESHOLD   = 0.22

    # ── Alert trigger durations (seconds) ─────────────────────────────────────
    EYE_CLOSED_ALERT_SECS  = 2.0   # eyes continuously closed
    GAZE_AWAY_ALERT_SECS   = 3.0   # looking left / right continuously
    LOOK_DOWN_ALERT_SECS   = 2.0   # looking down continuously
    PHONE_ALERT_SECS       = 1.5   # phone visible continuously
    NO_FACE_ALERT_SECS     = 3.0   # driver face not visible

    # ── Gaze / head-pose thresholds (degrees) ─────────────────────────────────
    GAZE_YAW_THRESHOLD         = 20   # left / right turn
    GAZE_PITCH_DOWN_THRESHOLD  = 10   # chin-down
    GAZE_PITCH_UP_THRESHOLD    = 15   # chin-up

    # ── Phone detection (YOLO) ────────────────────────────────────────────────
    YOLO_MODEL             = "yolov8n.pt"
    PHONE_CONF_THRESHOLD   = 0.45   # full-frame confidence
    # Lower threshold used on the face+ear ROI to catch occluded phones
    PHONE_CONF_THRESHOLD_NEAR_FACE = 0.28
    PHONE_CLASS_ID         = 67     # COCO: "cell phone"
    YOLO_SKIP_FRAMES       = 3      # run YOLO every N frames (performance)
    # Enlarge face bounding box by this factor when checking phone proximity
    PHONE_PROXIMITY_FACTOR = 1.8

    # ── Hand-at-ear detection (MediaPipe Hands) ───────────────────────────────
    # The palm centre must land inside this zone (relative to the face box)
    # for the "hand at ear" heuristic to fire.
    # x: how many face-widths to extend sideways beyond the face edges
    HAND_EAR_X_EXTEND = 1.0
    # y: fraction of face height to extend upward above the forehead
    HAND_EAR_Y_TOP_EXTEND = 0.2
    # y: fraction of face height to extend downward below the chin
    HAND_EAR_Y_BOT_EXTEND = 0.15
    HAND_DETECT_CONFIDENCE = 0.60

    # ── PERCLOS (scientific drowsiness metric) ────────────────────────────────
    # Rolling window length in seconds over which eye-closure proportion is
    # computed.  Standard clinical value is 60 s; 30 s is more reactive.
    PERCLOS_WINDOW_SECS      = 60.0
    # Proportion of the window that must be "eyes closed" to trigger drowsiness.
    # Dinges & Grace (1998) recommend 0.15 (15 %) for the P80 criterion.
    PERCLOS_DROWSY_THRESHOLD = 0.15
    # Seconds of sustained PERCLOS alert before it fires (0 = immediate,
    # the PERCLOS window itself already smooths the signal).
    DROWSY_ALERT_SECS        = 0.0

    # ── Seatbelt detection ────────────────────────────────────────────────────
    # Path to custom YOLOv8 seatbelt weights (relative to detectors/ dir).
    # If the file is absent, the Hough-line heuristic is used instead.
    SEATBELT_MODEL           = "seatbelt.pt"
    SEATBELT_CONF_THRESHOLD  = 0.40
    SEATBELT_OFF_ALERT_SECS  = 2.0   # warn after N seconds without a strap

    # ── Phone detection logging ───────────────────────────────────────────────
    PHONE_LOG_DETECTIONS  = True
    PHONE_DETECTION_LOG   = "phone_detections.csv"

    # ── Logging ───────────────────────────────────────────────────────────────
    LOG_FILE = "distraction_log.csv"
