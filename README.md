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
| 知乎 | 问答、用户、搜索等 |
| 快手 | 视频、用户、搜索等 |
| B站 | 视频、用户、搜索等 |
| Reddit | 帖子、用户、搜索等 |
| 微信 | 公众号文章等 |
| Threads / Lemon8 | 帖子、用户数据等 |

---

## 前置要求

- OpenClaw 已安装并运行
- Node.js >= 18
- TikHub API Token（从 https://tikhub.io 注册获取）

---

## 安装步骤

### 1. 克隆插件到 extensions 目录

```bash
cd ~/.openclaw/extensions
git clone https://github.com/rikouu/openclaw-tikhub-plugin.git tikhub
```

### 2. 安装依赖并编译

```bash
cd ~/.openclaw/extensions/tikhub
npm install
npm run build
```

编译成功后会生成 `dist/index.js`。

### 3. 配置插件

编辑 OpenClaw 配置文件：

```bash
nano ~/.openclaw/openclaw.json
```

在 `plugins.entries` 下添加：

```json
{
  "plugins": {
    "entries": {
      "tikhub": {
        "enabled": true,
        "config": {
          "apiToken": "你的TikHub API Token",
          "enabledCategories": [],
          "maxTools": 0
        }
      }
    }
  }
}
```

### 4. 重启 OpenClaw Gateway

```bash
systemctl --user restart openclaw-gateway
```

### 5. 验证安装

查看日志确认插件加载成功：

```bash
journalctl --user -u openclaw-gateway --since "1 minute ago" | grep TikHub
```

应看到类似输出：

```
[TikHub] 插件加载中... (categories: [])
[TikHub] 插件加载完成（已注册 tikhub_list_tools, tikhub_call_tool）
```

---

## 工作原理

插件注册两个通用工具：

| 工具 | 说明 |
|------|------|
| `tikhub_list_tools` | 列出指定平台的可用工具。传入 `category` 参数按平台筛选 |
| `tikhub_call_tool` | 调用指定的 TikHub 工具。传入 `tool_name` 和 `arguments` |

使用流程：
1. Agent 先调用 `tikhub_list_tools` 查看某个平台有哪些工具
2. 选择合适的工具，通过 `tikhub_call_tool` 调用

### 支持的 category 参数

| category | 平台 | 工具数 |
|----------|------|--------|
| `xiaohongshu` | 小红书 | ~56 |
| `tiktok` | TikTok | ~188 |
| `douyin` | 抖音 | ~223 |
| `instagram` | Instagram | ~56 |
| `youtube` | YouTube | ~16 |
| `twitter` | Twitter/X | ~13 |
| `weibo` | 微博 | ~38 |
| `zhihu` | 知乎 | ~32 |
| `kuaishou` | 快手 | ~30 |
| `bilibili` | B站 | ~24 |
| `reddit` | Reddit | ~21 |
| `wechat` | 微信 | ~19 |
| `lemon8` | Lemon8 | ~16 |

---

## 配置说明

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `apiToken` | string | 是 | - | TikHub API Bearer Token |
| `baseUrl` | string | 否 | `https://mcp.tikhub.io` | TikHub MCP API 地址 |
| `enabledCategories` | string[] | 否 | `[]`（全部启用） | 启用的平台分类前缀，空数组 = 全部 |
| `maxTools` | number | 否 | `100` | 最大工具数，0 = 不限 |

### 配置示例

**只启用小红书和抖音：**

```json
{
  "apiToken": "your-token-here",
  "enabledCategories": ["xiaohongshu", "douyin"],
  "maxTools": 100
}
```

**启用全部平台（推荐，工具按需懒加载不占上下文）：**

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

> 搜索知乎上关于 Claude 的讨论

> 搜索微博上关于"日元汇率"的内容
```

Agent 会自动调用 `tikhub_list_tools` 发现可用工具，再通过 `tikhub_call_tool` 执行具体操作。

---

## 故障排查

### 插件未加载

```bash
# 检查插件目录结构
ls ~/.openclaw/extensions/tikhub/dist/index.js

# 检查 openclaw.plugin.json 是否有 id 字段
cat ~/.openclaw/extensions/tikhub/openclaw.plugin.json

# 查看详细日志
journalctl --user -u openclaw-gateway --since "5 minutes ago" | grep -i tikhub
```

### API Token 无效

```bash
# 手动测试 Token 是否有效
curl -s -H "Authorization: Bearer YOUR_TOKEN" https://mcp.tikhub.io/tools | head -c 200
```

如果返回工具列表 JSON 则 Token 有效。

### 工具调用返回错误

检查 TikHub 账户余额和用量：

```bash
curl -s -X POST 'https://mcp.tikhub.io/tools/call' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"tool_name":"tikhub_user_get_user_info","arguments":{}}'
```

---

## OpenClaw 插件 API 注意事项

本插件适配了 OpenClaw 的插件系统，关键要点：

- **同步注册**：`register` 函数必须是同步的，异步注册会被忽略
- **插件配置**：通过 `api.pluginConfig` 获取（不是 `api.config`）
- **日志**：使用 `api.logger`（不是 `api.log`）
- **工具注册**：使用 `api.registerTool()`（不是 `api.registerAgentTool()`）
- **返回格式**：execute 必须返回 `{ content: [{type:"text", text:"..."}], details: payload }`
- **execute 签名**：`(toolCallId, params, signal?, onUpdate?) => Promise<AgentToolResult>`

---

## 开发

```bash
# 监听文件变化自动编译
npm run dev

# 修改代码后重启 OpenClaw 生效
systemctl --user restart openclaw-gateway
```

## 许可证

MIT
