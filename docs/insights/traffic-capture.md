# 接口自动化测试 - 产品思考

> 技术实现见 [docs/handover/traffic-capture.md](../handover/traffic-capture.md)

## 用户问题

团队习惯使用接口自动化测试工具（如 Postman），需要手动逐个创建测试用例。用户希望：
1. 在实际使用平台时自动录制所有 HTTP 请求
2. 根据 URL 中的组件标识过滤出关心的请求
3. 快速生成可复用的测试用例

## 设计决策

### 为什么用嵌入式 BrowserWindow 而不是外部 Chrome？

| 方案 | 优点 | 缺点 |
|------|------|------|
| 嵌入式 BrowserWindow | 用户体验流畅，无需额外配置，可通过 Electron API 直接拦截流量 | 需要处理多窗口生命周期 |
| 外部 Chrome + 调试端口 | 无需创建新窗口，流量直接来自用户已有浏览器 | 需要用户手动开启调试端口，增加使用门槛 |

**选择嵌入式方案**：降低用户使用门槛，一键即可开始录制。

### 为什么用 webRequest 而非 chrome-devtools MCP？

- `chrome-devtools MCP` 的 `list_network_requests` 需要 Chrome 开启调试端口
- `session.webRequest` 是 Electron 内置 API，直接在主进程拦截，无需额外配置
- 更适合隐藏窗口场景，避免调试端口依赖

### 为什么测试用例生成留到后续？

- 当前阶段聚焦流量录制核心功能
- 测试用例格式因团队而异（Postman/OpenAPI/自定义）
- 后续通过 AI + Prompt 根据录制的请求自动生成，灵活适配不同格式

## 用户流程

```
开启设置 → 点击 Lightning 按钮 → 输入目标 URL → 开始录制
    ↓
在 BrowserWindow 中操作平台 → 流量实时捕获
    ↓
删除不需要的请求 → 点击"生成测试用例"（后续实现）
```

## 未来方向

1. **AI 生成测试用例**：根据录制的请求，自动生成 Postman Collection 或 OpenAPI 定义
2. **批量导入**：支持导入已有的抓包文件（如 HAR、Fiddler SAZ）
3. **变量替换**：将硬编码的 ID、token 等替换为环境变量
4. **请求编辑**：在面板中直接编辑请求参数后重发测试
