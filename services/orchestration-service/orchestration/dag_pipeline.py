import redis
from rq import Queue

redis_conn = redis.Redis(host='localhost', port=6379)
q_ingest = Queue('ingestion', connection=redis_conn)
q_percept = Queue('perception', connection=redis_conn)
q_fusion = Queue('fusion', connection=redis_conn)
q_export = Queue('export', connection=redis_conn)

PIPELINE_DAG = {
    "pipeline": ["ingestion", "perception", "fusion", "kinematics", "export"]
}

def execute_pipeline(video_path, preset="high_quality"):
    '''
    Physical DAG executor. Dispatches the initial ingestion job.
    In RQ, dependencies can be managed via job.depends_on, but since our architecture
    is inherently streaming (ingestion enqueues perception), we kick off the root.
    '''
    print(f"Executing DAG pipeline for {video_path} with preset {preset}")
    job = q_ingest.enqueue('worker.process_video_job', video_path, job_timeout=3600)
    return job.id
