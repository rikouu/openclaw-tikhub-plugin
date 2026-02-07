# OpenClaw TikHub Plugin

将 [TikHub](https://tikhub.io) 社交媒体数据 API 接入 OpenClaw，支持 800+ 工具覆盖以下平台：

| 平台 | 能力 |
|------|------|
| 小红书 | 搜索笔记、搜索用户、笔记详情、评论等 |
| TikTok | 视频详情、用户主页、搜索、直播、评论等 |
| 抖音 | 视频、用户、搜索、直播、评论等 |
| Instagram | 帖子、用户、Reels、Stories、搜索等 |
| YouTube | 视频、频道、评论、搜索等 |
| Twitter/X | 推文、用户、搜索、列表等 |
| 微博 | 博文、用户、评论、搜索等 |
| 快手 | 视频、用户、搜索等 |
| Threads / Lemon8 | 帖子、用户数据等 |

---

## 前置要求

- OpenClaw 已安装并运行
- Node.js >= 18
- TikHub API Token（从 https://tikhub.io 注册获取）

---

## 安装步骤

### 1. 克隆/上传插件到服务器

```bash
# 方式 A：从 git 克隆（如果你把插件推到了 git 仓库）
cd ~/.openclaw/plugins
git clone <your-repo-url> tikhub

# 方式 B：直接复制目录
cp -r openclaw-tikhub-plugin ~/.openclaw/plugins/tikhub
```

### 2. 安装依赖并编译

```bash
cd ~/.openclaw/plugins/tikhub
npm install
npm run build
```

编译成功后会生成 `dist/index.js`。

### 3. 配置插件

编辑 OpenClaw 配置文件：

```bash
nano ~/.openclaw/openclaw.json
```

添加插件配置：

```json
{
  "plugins": {
    "enabled": true,
    "entries": {
      "tikhub": {
        "enabled": true,
        "config": {
          "apiToken": "你的TikHub API Token",
          "enabledCategories": ["xiaohongshu", "tiktok", "douyin"],
          "maxTools": 100
        }
      }
    }
  }
}
```

> 如果 `openclaw.json` 已有其他配置，将 `tikhub` 部分合并到 `plugins.entries` 下即可。

### 4. 重启 OpenClaw

```bash
openclaw gateway restart
```

### 5. 验证安装

查看日志确认插件加载成功：

```bash
openclaw logs | grep TikHub
```

应看到类似输出：

```
[TikHub] 正在连接 TikHub API...
[TikHub] 获取到 803 个工具
[TikHub] 注册 100 个工具，分类: 小红书(28), TikTok(35), 抖音(37)
[TikHub] 插件加载完成
```

---

## 配置说明

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `apiToken` | string | 是 | - | TikHub API Bearer Token |
| `baseUrl` | string | 否 | `https://mcp.tikhub.io` | TikHub MCP API 地址 |
| `enabledCategories` | string[] | 否 | `[]`（全部启用） | 启用的平台分类前缀 |
| `maxTools` | number | 否 | `100` | 最大注册工具数，0 表示不限 |

### 可用的分类前缀

| 前缀 | 平台 |
|------|------|
| `xiaohongshu` | 小红书 |
| `tiktok` | TikTok |
| `douyin` | 抖音 |
| `instagram` | Instagram |
| `youtube` | YouTube |
| `twitter` | Twitter/X |
| `weibo` | 微博 |
| `kuaishou` | 快手 |
| `threads` | Threads |
| `lemon8` | Lemon8 |
| `tikhub` | TikHub 通用（用户信息、计费等） |

### 配置示例

**只启用小红书和抖音，最多 50 个工具：**

```json
{
  "apiToken": "your-token-here",
  "enabledCategories": ["xiaohongshu", "douyin"],
  "maxTools": 50
}
```

**启用全部平台（不推荐，工具太多会占用上下文）：**

```json
{
  "apiToken": "your-token-here",
  "enabledCategories": [],
  "maxTools": 0
}
```

---

## 使用方式

插件加载后，在 OpenClaw 对话中直接用自然语言即可：

```
> 帮我搜索小红书上关于"日本不动产"的笔记

> 查一下 TikTok 用户 @charlidamelio 的主页信息

> 搜索抖音上最近的"东京租房"相关视频

> 获取这条 Instagram 帖子的详情：https://www.instagram.com/p/xxx

> 搜索微博上关于"日元汇率"的内容
```

Claude 会自动选择合适的 TikHub 工具并调用。

---

## 工具命名规则

注册到 OpenClaw 的工具名格式为 `tikhub_<原始工具名>`，例如：

| OpenClaw 工具名 | 对应 TikHub API |
|-----------------|----------------|
| `tikhub_xiaohongshu_web_search_notes` | 小红书搜索笔记 |
| `tikhub_xiaohongshu_web_search_users` | 小红书搜索用户 |
| `tikhub_tiktok_web_fetch_post_detail` | TikTok 视频详情 |
| `tikhub_tiktok_web_fetch_user_profile` | TikTok 用户主页 |
| `tikhub_douyin_web_fetch_general_search` | 抖音通用搜索 |
| `tikhub_instagram_web_fetch_post_detail` | Instagram 帖子详情 |
| `tikhub_youtube_web_fetch_video_detail` | YouTube 视频详情 |
| `tikhub_weibo_web_fetch_search` | 微博搜索 |

---

## 故障排查

### 插件未加载

```bash
# 检查插件目录结构
ls ~/.openclaw/plugins/tikhub/dist/index.js

# 检查配置是否正确
cat ~/.openclaw/openclaw.json | python3 -m json.tool

# 查看详细日志
openclaw logs --level debug | grep -i tikhub
```

### API Token 无效

```bash
# 手动测试 Token 是否有效
curl -s -H "Authorization: Bearer YOUR_TOKEN" https://mcp.tikhub.io/tools | head -c 200
```

如果返回工具列表 JSON 则 Token 有效。

### 工具调用失败

检查 TikHub 账户余额和用量：

```bash
curl -s -X POST 'https://mcp.tikhub.io/tools/call' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"tool_name":"tikhub_user_get_user_info","arguments":{}}'
```

---

## 开发

```bash
# 监听文件变化自动编译
npm run dev

# 修改代码后重启 OpenClaw 生效
openclaw gateway restart
```

## 许可证

MIT
