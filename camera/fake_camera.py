import requests
import random
import time

API_URL = "http://localhost:8080/api/passenger-count"
TRIP_ID = 1

count = 0

print("Fake camera started...")

while True:
    change = random.choice([-1, 0, 1])

    count += change
    if count < 0:
        count = 0

    payload = {
        "trip_id": TRIP_ID,
        "passenger_count": count,
        "method": "camera"
    }

    try:
        requests.post(API_URL, json=payload)
        print("Sent:", count)
    except:
        print("API not reachable")

    time.sleep(2)