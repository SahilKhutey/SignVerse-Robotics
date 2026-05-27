import redis
import json

redis_conn = redis.Redis(host='localhost', port=6379)
CHANNEL_NAME = 'signverse_events'

def publish_event(event_name, payload):
    '''
    Broadcast critical events using Redis Pub/Sub
    '''
    message = {
        "event": event_name,
        "payload": payload
    }
    redis_conn.publish(CHANNEL_NAME, json.dumps(message))
