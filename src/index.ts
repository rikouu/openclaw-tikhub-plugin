/**
 * OpenClaw TikHub Plugin
 *
 * 将 TikHub 社交媒体数据 API 注册为 OpenClaw Agent Tools，
 * 支持小红书、TikTok、抖音、Instagram、YouTube、Twitter、微博等 800+ 平台接口。
 */

// ── 类型定义 ──────────────────────────────────────────────

interface TikHubTool {
  name: string;
  description: string;
}

interface PluginConfig {
  apiToken: string;
  baseUrl?: string;
  enabledCategories?: string[];
  maxTools?: number;
}

interface ToolCallResult {
  result?: {
    code: number;
    data: unknown;
    message: string;
  };
  error?: string;
}

interface PluginAPI {
  config: PluginConfig;
  registerAgentTool: (tool: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    handler: (params: Record<string, unknown>) => Promise<unknown>;
  }) => void;
  log: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
}

// ── 常量 ──────────────────────────────────────────────────

const DEFAULT_BASE_URL = "https://mcp.tikhub.io";
const DEFAULT_MAX_TOOLS = 100;

/**
 * 平台分类映射（前缀 → 中文名称）
 * 用于日志和工具分组展示
 */
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

/**
 * 从工具名称提取分类前缀
 * 例: "xiaohongshu_web_search_notes" → "xiaohongshu"
 */
function getCategory(toolName: string): string {
  const knownPrefixes = Object.keys(CATEGORY_LABELS);
  for (const prefix of knownPrefixes) {
    if (toolName.startsWith(prefix)) return prefix;
  }
  // 取第一个下划线前的部分作为分类
  const idx = toolName.indexOf("_");
  return idx > 0 ? toolName.substring(0, idx) : toolName;
}

/**
 * 请求 TikHub API
 */
async function tikhubRequest(
  baseUrl: string,
  path: string,
  token: string,
  options: {
    method?: string;
    body?: unknown;
  } = {}
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

/**
 * 获取可用工具列表
 */
async function fetchToolList(
  baseUrl: string,
  token: string
): Promise<TikHubTool[]> {
  const data = await tikhubRequest(baseUrl, "/tools", token);
  if (!Array.isArray(data)) {
    throw new Error("TikHub /tools 返回格式异常");
  }
  return data as TikHubTool[];
}

/**
 * 调用 TikHub 工具
 */
async function callTool(
  baseUrl: string,
  token: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolCallResult> {
  const data = await tikhubRequest(baseUrl, "/tools/call", token, {
    method: "POST",
    body: {
      tool_name: toolName,
      arguments: args,
    },
  });
  return data as ToolCallResult;
}

/**
 * 过滤工具列表
 */
function filterTools(
  tools: TikHubTool[],
  enabledCategories: string[],
  maxTools: number
): TikHubTool[] {
  let filtered = tools;

  // 按分类过滤
  if (enabledCategories.length > 0) {
    filtered = tools.filter((t) => {
      const cat = getCategory(t.name);
      return enabledCategories.some(
        (enabled) => cat === enabled || t.name.startsWith(enabled)
      );
    });
  }

  // 限制数量
  if (maxTools > 0 && filtered.length > maxTools) {
    filtered = filtered.slice(0, maxTools);
  }

  return filtered;
}

// ── 插件入口 ──────────────────────────────────────────────

export default async function (api: PluginAPI) {
  const {
    apiToken,
    baseUrl = DEFAULT_BASE_URL,
    enabledCategories = [],
    maxTools = DEFAULT_MAX_TOOLS,
  } = api.config;

  if (!apiToken) {
    api.log.error("[TikHub] 未配置 apiToken，插件无法启动");
    return;
  }

  api.log.info("[TikHub] 正在连接 TikHub API...");

  // ── 1. 获取工具列表 ──

  let allTools: TikHubTool[];
  try {
    allTools = await fetchToolList(baseUrl, apiToken);
    api.log.info(`[TikHub] 获取到 ${allTools.length} 个工具`);
  } catch (err) {
    api.log.error(`[TikHub] 获取工具列表失败: ${err}`);
    return;
  }

  // ── 2. 过滤工具 ──

  const tools = filterTools(allTools, enabledCategories, maxTools);

  // 统计各分类数量
  const categoryCount: Record<string, number> = {};
  for (const t of tools) {
    const cat = getCategory(t.name);
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
  }

  api.log.info(
    `[TikHub] 注册 ${tools.length} 个工具，分类: ${Object.entries(categoryCount)
      .map(([k, v]) => `${CATEGORY_LABELS[k] || k}(${v})`)
      .join(", ")}`
  );

  // ── 3. 注册 Agent Tools ──

  for (const tool of tools) {
    const toolName = tool.name;

    api.registerAgentTool({
      // OpenClaw 工具名加前缀避免冲突
      name: `tikhub_${toolName}`,
      description: `[TikHub] ${tool.description}`,
      parameters: {
        type: "object",
        description:
          "传递给 TikHub API 的参数（具体参数请参考工具描述或 TikHub 文档）",
        additionalProperties: true,
      },
      handler: async (params: Record<string, unknown>) => {
        try {
          api.log.info(`[TikHub] 调用工具: ${toolName}`);
          const result = await callTool(baseUrl, apiToken, toolName, params);

          if (result.result) {
            return {
              success: true,
              code: result.result.code,
              message: result.result.message,
              data: result.result.data,
            };
          }

          return result;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          api.log.error(`[TikHub] 工具 ${toolName} 调用失败: ${message}`);
          return { success: false, error: message };
        }
      },
    });
  }

  api.log.info("[TikHub] 插件加载完成");
}
