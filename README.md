<p align="center">
  <img src="https://img.icons8.com/fluency/96/paper-plane.png" alt="Mailfly Logo" width="80"/>
</p>

<h1 align="center">Mailfly</h1>

<p align="center">
  <strong>基于 Cloudflare Workers 的轻量级临时邮箱服务</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white" alt="Cloudflare Workers"/>
  <img src="https://img.shields.io/badge/Database-D1-F38020?style=flat-square&logo=cloudflare&logoColor=white" alt="Cloudflare D1"/>
  <img src="https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript"/>
  <img src="https://img.shields.io/badge/Alpine.js-3.x-8BC0D0?style=flat-square&logo=alpine.js&logoColor=white" alt="Alpine.js"/>
  <img src="https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS"/>
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License"/>
</p>

<p align="center">
  <a href="#-功能特性">功能特性</a> •
  <a href="#-快速开始">快速开始</a> •
  <a href="#-api-接口">API 接口</a> •
  <a href="#%EF%B8%8F-配置说明">配置说明</a> •
  <a href="#-开源协议">开源协议</a>
</p>

---

## ✨ 功能特性

### 核心功能
- 🚀 **无服务器架构** - 完全运行在 Cloudflare Workers 边缘网络
- 📬 **邮件接收** - 原生集成 Cloudflare Email Routing
- ⏱️ **自动过期** - 可配置 TTL，自动清理过期邮箱
- 🌐 **多域名支持** - 支持配置多个自定义域名
- 🎨 **现代化界面** - 响应式设计，支持深色模式
- 🔒 **隐私优先** - 无追踪、无日志，邮件自动删除

### 高级功能
- 🔄 **多邮箱切换** - 同时管理多个临时邮箱
- ⏰ **邮箱续期** - 一键延长邮箱有效期
- 📤 **邮件转发** - 自动转发新邮件到指定邮箱
- 🗑️ **邮件删除** - 单独删除某封邮件（不影响统计）
- 📊 **统计面板** - 顶部实时统计栏 + 详细统计弹窗
- 🔑 **验证码提取** - 自动识别邮件中的验证码，一键复制

### 统计功能
- 📈 **顶部统计栏** - 实时显示今日收件、总收件、活跃邮箱
- 📉 **12小时趋势图** - 迷你柱状图展示近期邮件趋势
- 🏆 **发件人排行** - Top 5 发件人统计
- 🕐 **24小时分布** - 按小时统计邮件接收量
- 💾 **独立统计存储** - 删除邮件不影响历史统计数据

### 体验优化
- ⚡ **实时刷新** - 每 10 秒自动刷新收件箱
- 🔔 **桌面通知** - 新邮件到达时浏览器推送通知
- ⌨️ **快捷键支持** - R刷新、N新建、C复制、Esc关闭
- 📥 **原始邮件下载** - 支持下载 .eml 格式原始邮件

## 📦 技术栈

| 层级 | 技术 |
|------|------|
| 运行时 | Cloudflare Workers |
| 数据库 | Cloudflare D1 (SQLite) |
| 邮件服务 | Cloudflare Email Routing |
| 前端框架 | Alpine.js + Tailwind CSS |
| 邮件解析 | postal-mime |

## 🚀 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) >= 18
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- 已启用 Workers 和 D1 的 Cloudflare 账户

### 安装部署

```bash
# 克隆仓库
git clone https://git.specialz.org/Specialz/Mailfly.git
cd Mailfly

# 安装依赖
npm install

# 复制配置文件并修改
cp wrangler.example.jsonc wrangler.jsonc
# 编辑 wrangler.jsonc，填入你的 database_id 和域名

# 创建 D1 数据库
wrangler d1 create mailfly-db

# 初始化数据库结构
wrangler d1 execute mailfly-db --file=schema.sql

# 部署
wrangler deploy
```

### 配置邮件路由

1. 进入 Cloudflare 控制台 → 电子邮件 → Email Routing
2. 添加域名并验证 DNS 记录
3. 创建 Catch-all 规则 → 发送到 Worker → 选择 `mailfly`

### 配置邮件转发

转发功能使用 Cloudflare Email Routing 的 `message.forward()` API，转发目标邮箱需要先在 Cloudflare 控制台验证：

1. 进入 Cloudflare Dashboard → Email → Email Routing → Destination addresses
2. 添加并验证转发目标邮箱

## 📡 API 接口

### 认证

所有 `/api/*` 接口需要 Bearer Token 认证：

```bash
curl -H "Authorization: Bearer your-api-token" https://your-worker.dev/api/inbox
```

Token 类型：
- **Admin Token**: 在 `wrangler.jsonc` 中配置的 `ADMIN_TOKEN`，拥有所有权限
- **API Token**: 通过 API 创建的普通 Token，可访问邮箱相关接口

### Token 管理（需要 Admin Token）

| 方法 | 端点 | 描述 |
|------|------|------|
| `GET` | `/api/tokens` | 获取所有 API Token |
| `POST` | `/api/tokens` | 创建新 Token |
| `DELETE` | `/api/tokens/:token` | 删除 Token |

### 基础接口

| 方法 | 端点 | 描述 |
|------|------|------|
| `GET` | `/` | Web 界面 |
| `GET` | `/api/domains` | 获取可用域名列表 |
| `GET` | `/api/stats` | 获取全局统计数据 |

### 邮箱管理

| 方法 | 端点 | 描述 |
|------|------|------|
| `POST` | `/api/inbox` | 创建新邮箱 |
| `GET` | `/api/inbox/:address` | 获取邮箱邮件列表 |
| `DELETE` | `/api/inbox/:address` | 删除邮箱 |
| `POST` | `/api/inbox/:address/renew` | 续期邮箱 |
| `POST` | `/api/inbox/:address/forward` | 设置转发地址 |
| `GET` | `/api/inbox/:address/stats` | 获取邮箱统计 |

### 邮件操作

| 方法 | 端点 | 描述 |
|------|------|------|
| `GET` | `/api/mail/:id` | 获取邮件内容（含自动提取的验证码） |
| `GET` | `/api/mail/:id?format=raw` | 下载原始 .eml 文件 |
| `DELETE` | `/api/mail/:id` | 删除邮件 |

### 验证码提取

`GET /api/mail/:id` 返回的 JSON 中包含 `code` 字段，自动从邮件主题和正文中提取验证码：

```json
{
  "id": "xxx",
  "from_addr": "noreply@example.com",
  "subject": "您的验证码是 123456",
  "body": "...",
  "code": "123456"
}
```

支持的验证码格式：
- 4-8 位纯数字（如 `123456`）
- 4-8 位字母数字混合（如 `A1B2C3`）
- 关键词匹配：`验证码`、`code`、`码`

### 示例

**创建邮箱：**
```bash
curl -X POST https://your-worker.dev/api/inbox \
  -H "Content-Type: application/json" \
  -d '{"prefix": "test", "domain": "example.com"}'
```

**设置转发：**
```bash
curl -X POST https://your-worker.dev/api/inbox/test@example.com/forward \
  -H "Content-Type: application/json" \
  -d '{"forward_to": "your@email.com"}'
```

**获取统计：**
```bash
curl https://your-worker.dev/api/stats
```

## ⚙️ 配置说明

编辑 `wrangler.jsonc`：

```jsonc
{
  "name": "mailfly",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "mailfly-db",
      "database_id": "your-database-id-here"
    }
  ],
  "vars": {
    "DOMAINS": "example.com,mail.example.org",  // 逗号分隔的域名列表
    "MAIL_TTL": "3600",                          // 邮箱有效期（秒）
    "ADMIN_TOKEN": "your-secret-admin-token"     // 管理员 Token（用于管理 API Token）
  },
  "triggers": {
    "crons": ["0 0 * * *"]                      // 每日清理计划
  }
}
```

## 📁 项目结构

```
mailfly/
├── src/
│   ├── index.js      # 入口文件（fetch、email、scheduled 处理器）
│   ├── api.js        # HTTP API 路由和前端页面
│   └── email.js      # 邮件接收处理器（含转发逻辑）
├── schema.sql        # D1 数据库结构
├── wrangler.example.jsonc  # 配置示例
└── package.json
```

## 🗄️ 数据库结构

```sql
-- 邮箱表
CREATE TABLE inboxes (
    address TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    forward_to TEXT              -- 转发目标邮箱
);

-- 邮件表
CREATE TABLE emails (
    id TEXT PRIMARY KEY,
    inbox_address TEXT NOT NULL,
    from_addr TEXT NOT NULL,
    subject TEXT,
    body TEXT,
    raw TEXT,
    received_at INTEGER NOT NULL
);

-- 统计表（独立存储，删除邮件不影响统计）
CREATE TABLE stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_addr TEXT NOT NULL,
    received_at INTEGER NOT NULL
);
```

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `R` | 刷新邮件列表 |
| `N` | 创建新邮箱 |
| `C` | 复制当前邮箱地址 |
| `Esc` | 关闭邮件详情 |

## 🤝 参与贡献

欢迎提交 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing`)
5. 发起 Pull Request

## 📄 开源协议

本项目基于 MIT 协议开源 - 详见 [LICENSE](LICENSE) 文件。

---

<p align="center">
  Made with ❤️ by <a href="https://git.specialz.org/Specialz">Specialz</a>
</p>
