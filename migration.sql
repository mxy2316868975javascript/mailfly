-- 添加新字段到 inboxes 表
ALTER TABLE inboxes ADD COLUMN access_key TEXT;
ALTER TABLE inboxes ADD COLUMN user_id TEXT;

-- 为现有邮箱生成访问密钥
UPDATE inboxes SET access_key = 'key_' || lower(hex(randomblob(16))) WHERE access_key IS NULL;

-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_inboxes_access_key ON inboxes(access_key);
CREATE INDEX IF NOT EXISTS idx_inboxes_user_id ON inboxes(user_id);
