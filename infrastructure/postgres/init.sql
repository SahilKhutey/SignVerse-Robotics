CREATE TABLE videos (
    id UUID PRIMARY KEY,
    filename TEXT,
    source_type TEXT,
    fps INTEGER,
    duration FLOAT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE jobs (
    id UUID PRIMARY KEY,
    job_type TEXT,
    status TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
