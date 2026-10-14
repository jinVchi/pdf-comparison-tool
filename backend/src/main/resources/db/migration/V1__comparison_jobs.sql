CREATE TABLE comparison_job (
  id UUID PRIMARY KEY,
  owner_id VARCHAR(80) NOT NULL,
  status VARCHAR(20) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  revised_name VARCHAR(255) NOT NULL,
  original_size BIGINT NOT NULL,
  revised_size BIGINT NOT NULL,
  mode VARCHAR(12) NOT NULL,
  ignore_whitespace BOOLEAN NOT NULL,
  normalize_width BOOLEAN NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  page_count INTEGER NOT NULL DEFAULT 0,
  change_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  dispatched_at TIMESTAMP WITH TIME ZONE,
  error_message VARCHAR(500),
  result_json TEXT
);
CREATE INDEX job_owner_created ON comparison_job(owner_id, created_at);
CREATE INDEX job_status ON comparison_job(status, dispatched_at);
