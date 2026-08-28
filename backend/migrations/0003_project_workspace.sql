ALTER TABLE projects ADD COLUMN workspace_id TEXT REFERENCES workspaces(id);

CREATE INDEX idx_projects_workspace ON projects(workspace_id);
