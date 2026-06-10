import cv2
from ultralytics import YOLO

model = YOLO("yolov8n.pt")

cap = cv2.VideoCapture("videos/bus.mp4")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    results = model(frame)

    people = 0

    for box in results[0].boxes:
        cls = int(box.cls[0])
        if model.names[cls] == "person":
            people += 1

    cv2.putText(frame, f"People: {people}", (20,40),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0,255,0), 2)

    cv2.imshow("Test", frame)

    if cv2.waitKey(1) == 27:
        break