import cv2
import requests
from ultralytics import YOLO
import time

API_URL = "http://localhost:8080/api/passenger-count"
TRIP_ID = 1

model = YOLO("yolov8n.pt")

cap = cv2.VideoCapture(0)   # later camera

last_sent = 0

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

    cv2.imshow("Counter", frame)

    if time.time() - last_sent > 2:
        requests.post(API_URL, json={
            "trip_id": TRIP_ID,
            "passenger_count": people,
            "method": "camera"
        })
        last_sent = time.time()

    if cv2.waitKey(1) == 27:
        break