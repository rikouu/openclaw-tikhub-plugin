/**
 * OpenClaw TikHub Plugin
 *
 * 将 TikHub 社交媒体数据 API 注册为 OpenClaw Agent Tools，
 * 支持小红书、TikTok、抖音、Instagram、YouTube、Twitter、微博等平台。
 *
 * 由于 OpenClaw 插件注册必须同步，采用两个通用工具：
 * - tikhub_list_tools: 列出可用工具
 * - tikhub_call_tool: 调用指定工具
 */

// ── 类型定义 ──────────────────────────────────────────────

interface PluginConfig {
  apiToken: string;
  baseUrl?: string;
  enabledCategories?: string[];
  maxTools?: number;
}

interface PluginLogger {
  debug?: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}

interface PluginAPI {
  id: string;
  pluginConfig?: PluginConfig;
  config: Record<string, unknown>;
  logger: PluginLogger;
  registerTool: (tool: Record<string, unknown>, opts?: Record<string, unknown>) => void;
}

interface TikHubTool {
  name: string;
  description: string;
}

// ── 常量 ──────────────────────────────────────────────────

const DEFAULT_BASE_URL = "https://mcp.tikhub.io";
const DEFAULT_MAX_TOOLS = 100;

const CATEGORY_LABELS: Record<string, string> = {
  xiaohongshu: "小红书",
  tiktok: "TikTok",
  douyin: "抖音",
  instagram: "Instagram",
  youtube: "YouTube",
  twitter: "Twitter/X",
  weibo: "微博",
  kuaishou: "快手",
  threads: "Threads",
  lemon8: "Lemon8",
  tikhub: "TikHub 通用",
  health: "健康检查",
};

// ── 工具函数 ──────────────────────────────────────────────

function getCategory(toolName: string): string {
  const knownPrefixes = Object.keys(CATEGORY_LABELS);
  for (const prefix of knownPrefixes) {
    if (toolName.startsWith(prefix)) return prefix;
  }
  const idx = toolName.indexOf("_");
  return idx > 0 ? toolName.substring(0, idx) : toolName;
}

async function tikhubRequest(
  baseUrl: string,
  path: string,
  token: string,
  options: { method?: string; body?: unknown } = {}
): Promise<unknown> {
  const { method = "GET", body } = options;
  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const fetchOptions: RequestInit = { method, headers };
  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }
  const response = await fetch(url, fetchOptions);
  if (!response.ok) {
    throw new Error(`TikHub API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

function filterTools(
  tools: TikHubTool[],
  enabledCategories: string[],
  maxTools: number
): TikHubTool[] {
  let filtered = tools;
  if (Array.isArray(enabledCategories) && enabledCategories.length > 0) {
    filtered = tools.filter((t) => {
      const cat = getCategory(t.name);
      return enabledCategories.some(
        (enabled) => cat === enabled || t.name.startsWith(enabled)
      );
    });
  }
  if (maxTools > 0 && filtered.length > maxTools) {
    filtered = filtered.slice(0, maxTools);
  }
  return filtered;
}

/**
 * 将结果包装为 OpenClaw AgentToolResult 格式
 * OpenClaw 要求 execute 返回 { content: [{type:"text", text:"..."}], details: payload }
 */
function jsonResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

// ── 插件入口（同步） ─────────────────────────────────────

export default function register(api: PluginAPI) {
  const pluginConfig = (api.pluginConfig || {}) as PluginConfig;

  // 调试：输出实际收到的 pluginConfig
  api.logger.info(`[TikHub] pluginConfig keys: ${JSON.stringify(Object.keys(pluginConfig))}`);

  const apiToken = pluginConfig.apiToken;
  const baseUrl = pluginConfig.baseUrl || DEFAULT_BASE_URL;
  const enabledCategories = Array.isArray(pluginConfig.enabledCategories)
    ? pluginConfig.enabledCategories
    : [];
  const maxTools = pluginConfig.maxTools ?? DEFAULT_MAX_TOOLS;

  if (!apiToken) {
    api.logger.error("[TikHub] 未配置 apiToken，插件无法启动");
    return;
  }

  api.logger.info(`[TikHub] 插件加载中... (categories: ${JSON.stringify(enabledCategories)})`);

  // 工具列表缓存
  let cachedTools: TikHubTool[] | null = null;

  async function getTools(): Promise<TikHubTool[]> {
    if (cachedTools) return cachedTools;
    const data = await tikhubRequest(baseUrl, "/tools", apiToken);
    if (!Array.isArray(data)) {
      throw new Error("TikHub /tools 返回格式异常");
    }
    cachedTools = filterTools(data as TikHubTool[], enabledCategories, maxTools);
    return cachedTools;
  }

  // ── 工具 1: 列出可用工具 ──

  api.registerTool({
    name: "tikhub_list_tools",
    description:
      "[TikHub] 列出所有可用的社交媒体数据工具。" +
      "支持平台包括：小红书、TikTok、抖音、Instagram、YouTube、Twitter/X、微博、知乎、快手、B站、Reddit、微信、Lemon8 等 800+ 工具。" +
      "必须传 category 参数来按平台筛选（如 xiaohongshu/tiktok/douyin/instagram/youtube/twitter/weibo/zhihu/kuaishou/bilibili/reddit/wechat/lemon8）。" +
      "不传 category 会返回全部工具列表。",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "可选：按平台分类筛选（如 xiaohongshu, tiktok, douyin, instagram, youtube, twitter）",
        },
      },
    },
    execute: async (_toolCallId: string, params: { category?: string }) => {
      try {
        let tools = await getTools();
        if (params?.category) {
          tools = tools.filter((t) => getCategory(t.name) === params.category);
        }
        // 按分类分组
        const grouped: Record<string, { name: string; description: string }[]> = {};
        for (const t of tools) {
          const cat = getCategory(t.name);
          const label = CATEGORY_LABELS[cat] || cat;
          if (!grouped[label]) grouped[label] = [];
          grouped[label].push({ name: t.name, description: t.description });
        }
        return jsonResult({
          total: tools.length,
          tools: grouped,
          usage: "使用 tikhub_call_tool 工具调用具体工具，传入 tool_name 和 arguments",
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        api.logger.error(`[TikHub] 获取工具列表失败: ${msg}`);
        return jsonResult({ error: msg });
      }
    },
  });

  // ── 工具 2: 调用指定工具 ──

  api.registerTool({
    name: "tikhub_call_tool",
    description:
      "[TikHub] 调用指定的 TikHub 社交媒体数据工具。" +
      "先用 tikhub_list_tools 按 category 查看该平台可用工具，再用此工具调用。" +
      "支持小红书、TikTok、抖音、Instagram、YouTube、Twitter、微博、知乎、快手、B站、Reddit、微信等平台的搜索、用户信息、帖子内容获取。",
    parameters: {
      type: "object",
      properties: {
        tool_name: {
          type: "string",
          description: "要调用的工具名称（从 tikhub_list_tools 获取）",
        },
        arguments: {
          type: "object",
          description: "传递给工具的参数（具体参数请参考工具描述或 TikHub 文档）",
          additionalProperties: true,
        },
      },
      required: ["tool_name"],
    },
    execute: async (_toolCallId: string, params: { tool_name: string; arguments?: Record<string, unknown> }) => {
      const { tool_name, arguments: args = {} } = params || {};
      try {
        api.logger.info(`[TikHub] 调用工具: ${tool_name}`);
        const data = await tikhubRequest(baseUrl, "/tools/call", apiToken, {
          method: "POST",
          body: { tool_name, arguments: args },
        }) as { result?: { code: number; data: unknown; message: string } };

        if (data.result) {
          return jsonResult({
            success: true,
            code: data.result.code,
            message: data.result.message,
            data: data.result.data,
          });
        }
        return jsonResult(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        api.logger.error(`[TikHub] 工具 ${tool_name} 调用失败: ${msg}`);
        return jsonResult({ success: false, error: msg });
      }
    },
  });

  api.logger.info("[TikHub] 插件加载完成（已注册 tikhub_list_tools, tikhub_call_tool）");
}
