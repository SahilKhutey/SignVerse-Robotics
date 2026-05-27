# SignVerse Architecture

Sign-Verse follows the **Infrastructure First, AI Second** philosophy. 
Data flows continuously from Left-to-Right across the message broker:

`RAW VIDEO` -> `INGESTION` -> `PERCEPTION` -> `KINEMATICS` -> `SIMULATION` -> `AI` -> `EXPORT`

### Data Structures
- All inter-service communication utilizes strict JSON payloads defined in `packages/motion-format/schema.py`.
- No service is allowed to communicate synchronously. All data passes through Redis `rq` queues.
