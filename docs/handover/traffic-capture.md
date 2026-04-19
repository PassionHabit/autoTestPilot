# 接口自动化测试 - 流量录制功能

> 产品思考见 [docs/insights/traffic-capture.md](../insights/traffic-capture.md)

## 功能概述

新增接口自动化测试扩展功能，聚焦流量录制阶段：

1. 用户在设置中开启"接口测试"开关
2. 点击顶部栏的 Lightning 图标打开流量录制面板
3. 输入目标平台 URL 和组件标识过滤条件
4. 点击"开始"启动隐藏的 BrowserWindow 加载目标网站
5. 实时捕获 XHR/Fetch 请求并展示在面板中
6. 用户可手动删除不需要的请求
7. 点击"停止"销毁录制窗口

---

## 技术架构

### 布局结构

```
AppShell 布局:
[ChatListPanel] | [TrafficCapturePanel] | [主聊天区]
                      ↑
                新增面板，位于左侧列表和主内容区之间
                宽度 280-500px，可拖拽调整
```

### 核心组件

| 组件 | 文件路径 | 职责 |
|------|----------|------|
| TrafficCapturePanel | `src/components/chat/TrafficCapturePanel.tsx` | 录制面板 UI：URL输入、请求列表、过滤删除 |
| AppShell | `src/components/layout/AppShell.tsx` | 面板容器，管理面板显示/隐藏状态 |
| UnifiedTopBar | `src/components/layout/UnifiedTopBar.tsx` | 顶部工具栏，Lightning 按钮控制面板 |
| usePanel | `src/hooks/usePanel.ts` | Panel 上下文，管理 trafficPanelOpen 状态 |

### Electron 主进程

| 文件 | 职责 |
|------|------|
| `electron/main.ts` | BrowserWindow 创建、webRequest 拦截、IPC 处理器 |
| `electron/preload.ts` | contextBridge 暴露 traffic API 到渲染进程 |

### API 层

| 文件 | 方法 | 职责 |
|------|------|------|
| `src/app/api/traffic-capture/route.ts` | GET | 获取已捕获的请求列表 |
| `src/app/api/traffic-capture/route.ts` | POST | 创建新的捕获记录 |
| `src/app/api/traffic-capture/route.ts` | DELETE | 删除指定请求或清空会话 |
| `src/app/api/settings/app/route.ts` | GET/PUT | api_test_enabled 设置项 |

### 数据层

| 文件 | 内容 |
|------|------|
| `src/lib/db.ts` | `captured_requests` 表 + CRUD 函数 |
| `src/types/index.ts` | `CapturedRequest` 接口定义 |

---

## 数据流

```
用户输入 URL + 点击"开始录制"
  → IPC: traffic:start({ url, componentTag })
  → Electron 创建独立 Session 的 BrowserWindow
  → session.webRequest.onBeforeRequest 拦截请求
  → IPC: traffic:capture 实时推送数据到渲染进程
  → TrafficCapturePanel 展示 + 按 componentTag 过滤
  → 用户手动删除不需要的请求
  → API: DELETE /api/traffic-capture 删除记录

点击"停止录制"
  → IPC: traffic:stop
  → Electron 销毁 BrowserWindow
```

---

## IPC 通信协议

| IPC 通道 | 方向 | 参数 | 返回值 |
|----------|------|------|--------|
| `traffic:start` | renderer → main | `{ url: string, componentTag?: string }` | `{ success: boolean, error?: string }` |
| `traffic:stop` | renderer → main | - | `{ success: boolean }` |
| `traffic:status` | renderer → main | - | `{ isCapturing: boolean, hasWindow: boolean }` |
| `traffic:capture` | main → renderer | `CapturedRequest` 对象 | - |
| `traffic:capture-update` | main → renderer | `{ id, responseStatus, responseHeaders }` | - |

---

## 数据库 Schema

```sql
CREATE TABLE IF NOT EXISTS captured_requests (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  request_headers TEXT,
  request_body TEXT,
  response_status INTEGER,
  response_headers TEXT,
  response_body TEXT,
  component_tag TEXT,
  captured_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_captured_requests_session_id ON captured_requests(session_id);
CREATE INDEX idx_captured_requests_component_tag ON captured_requests(component_tag);
```

---

## 关键实现点

### 1. 独立 Session 的 BrowserWindow

```typescript
// electron/main.ts
trafficCaptureSession = session.fromPartition(`traffic-capture-${Date.now()}`);

trafficCaptureWindow = new BrowserWindow({
  show: false,  // 隐藏窗口
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    session: trafficCaptureSession,  // 使用独立 session
  },
});
```

### 2. webRequest 流量拦截

```typescript
trafficCaptureSession.webRequest.onBeforeRequest(async (details, callback) => {
  // 过滤 XHR/Fetch 请求
  const isAjax = contentType.includes('application/json') ||
    details.url.includes('/api/') ||
    details.resourceType === 'xhr';

  if (isAjax) {
    // 发送到渲染进程
    mainWindow?.webContents.send('traffic:capture', capturedData);
  }
  callback({ cancel: false });
});
```

### 3. 面板状态管理

```typescript
// AppShell.tsx
const [trafficPanelOpen, setTrafficPanelOpen] = useState(false);

// UnifiedTopBar.tsx - 点击按钮切换
<Button onClick={() => setTrafficPanelOpen(!trafficPanelOpen)}>

// TrafficCapturePanel - 关闭时回调
onClose={() => setTrafficPanelOpen(false)}
```

---

## 验证方式

1. 启动 `npm run electron:dev`
2. 开启设置中的"接口测试"开关
3. 顶部栏出现 Lightning 图标按钮
4. 点击按钮打开流量录制面板
5. 输入目标 URL（如 `https://httpbin.org/get`）
6. 点击"开始"，验证隐藏 BrowserWindow 加载目标页面
7. 在 BrowserWindow 中执行操作
8. 验证流量实时显示在面板
9. 验证组件标识过滤功能
10. 验证删除功能正常
11. 点击"停止"验证 BrowserWindow 销毁

---

## 依赖项

- Electron `session.webRequest` API（已有）
- `nanoid` 生成请求 ID（已有）
- 无新增外部依赖
