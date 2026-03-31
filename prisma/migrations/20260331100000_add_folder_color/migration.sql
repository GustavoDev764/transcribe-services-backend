-- Add folder color support used by frontend sidebar.
ALTER TABLE "folders"
ADD COLUMN IF NOT EXISTS "color" TEXT NOT NULL DEFAULT '#60A5FA';
