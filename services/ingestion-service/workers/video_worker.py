import redis
import json

r = redis.Redis(host='localhost', port=6379, db=0)

print("Starting video worker...")
while True:

    _, job = r.brpop("video_ingestion_queue")

    payload = json.loads(job)

    print("Processing:", payload)
