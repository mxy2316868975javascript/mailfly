-- 邮箱表
CREATE TABLE IF NOT EXISTS inboxes (
    address TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    forward_to TEXT,
    access_key TEXT NOT NULL,
    user_id TEXT
);

-- 邮件表
CREATE TABLE IF NOT EXISTS emails (
    id TEXT PRIMARY KEY,
    inbox_address TEXT NOT NULL,
    from_addr TEXT NOT NULL,
    subject TEXT,
    body TEXT,
    raw TEXT,
    received_at INTEGER NOT NULL,
    FOREIGN KEY (inbox_address) REFERENCES inboxes(address)
);

-- 统计表（删除邮件不影响统计）
CREATE TABLE IF NOT EXISTS stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_addr TEXT NOT NULL,
    received_at INTEGER NOT NULL
);

-- API Token 表
CREATE TABLE IF NOT EXISTS api_tokens (
    token TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_emails_inbox ON emails(inbox_address);
CREATE INDEX IF NOT EXISTS idx_inboxes_expires ON inboxes(expires_at);
CREATE INDEX IF NOT EXISTS idx_inboxes_access_key ON inboxes(access_key);
CREATE INDEX IF NOT EXISTS idx_inboxes_user_id ON inboxes(user_id);
CREATE INDEX IF NOT EXISTS idx_stats_received ON stats(received_at);
