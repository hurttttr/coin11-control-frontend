# Coin11-TB 控制平台前端

> coin11-control-frontend — coin11-tb 自动化任务系统的 Web 控制面板前端

基于 **Vue 3 + TypeScript + Vite** 构建，通过 **WebSocket** 与后端实时通信，提供 Android 设备管理、自动化任务调度、实时设备画面预览和日志查看等功能。

> 本项目基于 [coin11-tb](https://github.com/czl0325/coin11-tb) 二次开发，后者提供了淘宝/支付宝/闲鱼等平台的自动化脚本。  
> 配套后端项目：[coin11-control-backend](https://github.com/hurttttr/coin11-control-backend)

---

## 目录

- [项目简介](#项目简介)
- [截图预览](#截图预览)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [功能说明](#功能说明)
  - [仪表盘](#仪表盘)
  - [设备管理](#设备管理)
  - [设备详情](#设备详情)
  - [任务队列](#任务队列)
  - [实时画面](#实时画面)
  - [日志终端](#日志终端)
  - [版本更新](#版本更新)
- [路由说明](#路由说明)
- [WebSocket 通信](#websocket-通信)
- [开发说明](#开发说明)
- [构建部署](#构建部署)
- [许可协议](#许可协议)

---

## 项目简介

Coin11-TB 控制平台前端是一个面向 Android 设备自动化测试/运维场景的 Web 管理界面。它允许用户：

- **管理设备** — 查看设备在线状态、型号、Android 版本，支持 USB/WiFi 连接和断开
- **调度任务** — 为每台设备维护独立的自动化任务队列，支持拖拽排序、添加/移除任务、启停队列
- **实时监控** — 通过 WebSocket 流式传输设备截图和日志，实现远程设备画面预览和实时日志输出
- **全局管控** — 仪表盘提供设备统计和任务概览，全局任务列表支持跨设备管理

后端服务为 [coin11-control-backend](https://github.com/hurttttr/coin11-control-backend)（Python + FastAPI），前端通过 REST API 和 WebSocket 与之通信。

---

## 截图预览

| 页面 | 预览 |
|------|------|
| 仪表盘 | 设备卡片网格 + 统计卡片 + 任务概览 |
| 设备详情 | 实时画面 + 可拖拽任务队列 + 日志终端 |
| 任务列表 | 按设备分组的全部任务视图 |

> 项目采用暗色科技风主题（Dark Tech Theme），主色调 `#00f0ff`（青色）。

---

## 技术栈

| 类别 | 技术 |
|------|------|
| **框架** | Vue 3 (Composition API) + TypeScript |
| **构建工具** | Vite 6 |
| **状态管理** | Pinia 3 |
| **路由** | Vue Router 4 (History 模式) |
| **样式方案** | Tailwind CSS v4 + Scoped CSS + CSS 自定义属性（暗色主题） |
| **实时通信** | 原生 WebSocket (无第三方库) |
| **拖拽排序** | vuedraggable 4 (基于 SortableJS) |
| **HTML 渲染** | ansi-to-html (日志 ANSI 转义) + DOMPurify (安全过滤) |
| **单元测试** | Vitest + Vue Test Utils + happy-dom |
| **包管理** | npm |

---

## 快速开始

### 环境要求

- **Node.js** >= 18.x
- **npm** >= 9.x

### 安装与启动

```bash
# 1. 克隆仓库
git clone https://github.com/your-org/coin11-control-frontend.git
cd coin11-control-frontend

# 2. 安装依赖
npm install

# 3. 启动开发服务器（默认端口 5173）
npm run dev
```

启动后访问 `http://localhost:5173` 即可打开控制面板。

> **提示**：开发服务器已配置代理，`/api/*` 请求转发至 `http://localhost:8000`，`/ws/*` 转发至 `ws://localhost:8000`。请确保后端 coin11-tb 服务已启动。

### 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器（热重载） |
| `npm run build` | TypeScript 类型检查 + 生产构建 |
| `npm run preview` | 本地预览生产构建产物 |
| `npm run test` | 运行单元测试（Vitest） |

---

## 项目结构

```
coin11-control-frontend/
├── index.html                       # HTML 入口
├── vite.config.ts                   # Vite 配置（代理、别名、Tailwind）
├── tsconfig.json                    # TypeScript 配置
├── package.json                     # 依赖 & 脚本
├── env.d.ts                         # 类型声明（.vue 模块、vuedraggable）
├── public/                          # 静态资源
│   └── vite.svg
├── dist/                            # 构建输出
└── src/
    ├── main.ts                      # Vue 应用入口（创建 Pinia + Router）
    ├── App.vue                      # 根组件（挂载 AppLayout）
    ├── assets/
    │   └── styles/
    │       └── global.css           # 全局样式（暗色主题 CSS 变量 + Tailwind）
    ├── router/
    │   └── index.ts                 # Vue Router 路由配置（3 条路由）
    ├── stores/                      # Pinia 状态管理
    │   ├── devices.ts               # 设备状态（列表、连接/断开、轮询）
    │   ├── tasks.ts                 # 任务状态（队列 CRUD、拖拽排序、启停）
    │   ├── websocket.ts             # WebSocket 连接管理（多设备、自动重连）
    │   └── update.ts                # 版本更新管理（检查、拉取、消除）
    ├── types/
    │   └── index.ts                 # TypeScript 类型定义（设备、任务、WS 消息）
    ├── views/                       # 页面级组件
    │   ├── DashboardView.vue        # 仪表盘（设备概览 + 统计卡片 + 任务概览）
    │   ├── DeviceDetailView.vue     # 设备详情（画面 + 队列 + 日志）
    │   └── TaskListView.vue         # 全局任务列表（按设备分组）
    ├── components/
    │   ├── layout/                  # 布局组件
    │   │   ├── AppLayout.vue        # 主布局（侧边栏 + 内容区 + 路由视图）
    │   │   └── SideNav.vue          # 侧边导航（仪表盘/设备/任务列表）
    │   ├── device/                  # 设备相关组件
    │   │   ├── DeviceCard.vue       # 设备卡片（状态、型号、连接方式、断开按钮）
    │   │   └── DeviceGrid.vue       # 设备网格（卡片列表 + 远程连接输入框）
    │   ├── task/                    # 任务相关组件
    │   │   ├── TaskQueue.vue        # 任务队列（可拖拽排序、启停、清空）
    │   │   └── ScriptSelector.vue   # 脚本选择弹窗
    │   ├── monitor/                 # 监控组件
    │   │   ├── ScreenViewer.vue     # 实时设备画面（WebSocket 截图流）
    │   │   └── LogViewer.vue        # 实时日志终端（自动滚动、暂停/继续）
    │   └── common/                  # 通用组件
    │       ├── StatusIndicator.vue  # 状态指示灯（在线/离线/忙碌 + 脉冲动画）
    │       └── UpdateBanner.vue     # 版本更新横幅
    └── __tests__/                   # 单元测试
        ├── DeviceCard.spec.ts
        ├── TaskQueue.spec.ts
        ├── LogViewer.spec.ts
        └── stores/
            └── devices.spec.ts
```

---

## 功能说明

### 仪表盘

仪表盘（`/`）是登录后的默认页面，包含三个区域：

1. **统计卡片** — 在顶部展示四组数据：
   - 在线设备数（绿色）
   - 忙碌设备数（蓝色）
   - 离线设备数（红色）
   - 活跃任务数（黄色，= 运行中 + 等待中）

2. **设备列表** — 以自适应网格布局展示所有设备卡片。每张卡片显示：
   - 状态指示灯（在线/离线/忙碌，带脉冲动画）
   - 设备型号和序列号
   - 连接方式（USB/WiFi）
   - Android 版本
   - 悬停显示的断开按钮
   - 点击卡片跳转至设备详情页

3. **任务概览** — 显示全部任务的统计分布：等待中、运行中、已完成、失败。

### 设备管理

在仪表盘底部的 **DeviceGrid** 组件中，提供：

- **远程连接** — 输入设备 IP:Port，通过 `POST /api/devices/connect` 发起 ADB WiFi 连接
- **自动轮询** — 每 10 秒自动刷新设备列表（通过 `GET /api/devices`）
- **手动刷新** — 点击刷新按钮立即拉取
- **断开设备** — 悬停设备卡片时显示"断开"按钮

### 设备详情

设备详情页（`/device/:id`）是核心操作界面，布局分为三块：

- **左侧** — 实时设备画面（ScreenViewer）
- **右侧** — 任务队列管理（TaskQueue）
- **底部全宽** — 实时日志终端（LogViewer）

页面顶部显示设备型号、序列号、状态指示灯、Android 版本和连接方式。

### 任务队列

**TaskQueue** 组件为每台设备维护独立的自动化任务队列：

- **添加任务** — 点击"添加任务"弹出脚本选择器（从后端获取可用脚本列表），选择后自动入队
- **拖拽排序** — 使用 `vuedraggable`，通过拖拽手柄（⠿）调整任务执行顺序，自动同步至后端
- **任务状态标签** — 每个任务显示状态徽标：
  - ⏳ 等待中（黄色）
  - ⟳ 运行中（蓝色，带旋转动画）
  - ✓ 已完成（绿色）
  - ✕ 失败（红色）
- **队列控制** — 工具栏提供："开始执行"（启动队列）、"停止"（停止队列）、"清空已完成"（移除已完成任务）
- **移除任务** — 每行右侧的 ✕ 按钮可单独移除任务

任务数据通过 REST API 和后端同步，同时 WebSocket 推送的状态变更会实时更新 UI。

### 实时画面

**ScreenViewer** 组件通过 WebSocket 接收服务端推送的截图数据：

- 自动检测图片格式（PNG/JPEG）
- 以 16:9 比例显示设备屏幕画面
- 画面角落显示设备状态标签（online/busy/idle/running）
- 连接等待时显示加载动画
- WebSocket 断开时显示"等待设备连接..."

### 日志终端

**LogViewer** 组件提供类终端的实时日志查看体验：

- 深色终端风格背景（`#0a0e1a`），等宽字体（JetBrains Mono / Fira Code）
- 绿色日志文本（`#00ff41`，带发光效果），模拟经典终端
- 自动滚动到底部（跟随新日志输出）
- **暂停/继续** — 点击暂停按钮冻结滚动，方便回溯查看
- **清空** — 一键清除当前日志缓冲区
- 行号显示 + 时间戳标注
- WebSocket 连接状态指示（● 已连接 / ○ 未连接）

### 版本更新

**UpdateBanner** 组件在页面顶部显示版本更新提示：

- 自动检查后端是否有新版本（`GET /api/update/check`）
- 显示落后提交数和最新 commit hash
- **立即更新** — 调用 `POST /api/update/pull` 触发后端更新拉取
- **关闭** — 可消除本次更新提示

---

## 路由说明

| 路径 | 名称 | 页面 | 说明 |
|------|------|------|------|
| `/` | dashboard | DashboardView | 仪表盘（默认页） |
| `/device/:id` | device-detail | DeviceDetailView | 设备详情（serial 作为 ID） |
| `/tasks` | tasks | TaskListView | 全局任务列表 |
| `/:pathMatch(.*)*` | — | 重定向至 `/` | 404 兜底 |

所有路由使用 **History 模式**（`createWebHistory`），URL 中不含 `#`。

---

## WebSocket 通信

### 连接机制

前端使用**原生 WebSocket**（非第三方库）与后端建立实时通信。每台设备维护独立的 WebSocket 连接。

```
ws://<host>/ws/device/<device_id>?token=coin11-control-token
```

- 连接地址自动根据页面协议选择 `ws://` 或 `wss://`
- 开发环境下 `/ws/*` 请求通过 Vite 代理转发至 `ws://localhost:8000`

### 自动重连

- 采用**指数退避**策略：1s → 2s → 4s → 8s → 16s（最大间隔 16 秒）
- 最多重试 **5 次**，超出后停止重连
- 页面离开设备详情时自动断开连接（`onUnmounted`）

### 消息格式

所有消息均为 JSON 格式：

```typescript
interface WSMessage {
  type: 'log' | 'screenshot' | 'screencast' | 'status' | 'error' | 'pong'
  device_id: string
  data: string
}
```

| 消息类型 | 说明 | data 内容 |
|----------|------|-----------|
| `screenshot` | 设备截图 | Base64 编码的图片数据（PNG/JPEG） |
| `screencast` | 持续截图流 | Base64 编码的图片数据 |
| `log` | 实时日志行 | 日志文本（支持 ANSI 转义序列） |
| `status` | 设备状态变化 | 状态字符串（如 `online`/`busy`/`idle`/`running`） |
| `error` | 错误信息 | 错误描述文本 |
| `pong` | 心跳回复 | — |

### 发送消息

前端可通过 WebSocket 发送控制指令：

```typescript
wsStore.send(deviceId, { action: 'screenshot' })    // 请求截图
wsStore.send(deviceId, { action: 'ping' })          // 心跳检测
```

### 消息缓冲

- 每台设备的消息独立存储，缓冲区上限 **2000 条**
- 超过上限时自动丢弃最旧的消息

---

## 开发说明

### TypeScript

- 项目全程使用 **TypeScript**（`strict: true`）
- 类型定义集中在 `src/types/index.ts`
- 使用 `@` 路径别名指向 `src/` 目录（在 `vite.config.ts` 和 `tsconfig.json` 中配置）
- 状态管理中全部使用类型化的 `ref`、`computed` 和 Pinia store

### Vue 3 Composition API

- 全部组件使用 `<script setup lang="ts">` 语法
- 组合式 API 风格，无 Options API 混用
- `defineProps`/`defineEmits` 使用泛型约束类型安全

### Pinia 状态管理

四个独立 Store：

| Store | 职责 | 核心数据 |
|-------|------|----------|
| `useDeviceStore` | 设备列表管理 | `devices`、`loading`、轮询定时器 |
| `useTaskStore` | 任务队列管理 | `taskQueues`、`scripts`、增删改查 |
| `useWebSocketStore` | WebSocket 连接管理 | `connections` Map、消息缓冲、重连逻辑 |
| `useUpdateStore` | 版本更新管理 | `updateInfo`、检查/拉取/消除 |

Store 之间通过 `storeToRefs` 解构响应式数据，保持组件简洁。

### 样式体系

- **Tailwind CSS v4** — 用于工具类样式（通过 `@import "tailwindcss"` 引入）
- **CSS 自定义属性** — 在 `global.css` 中定义暗色主题变量
- **Scoped CSS** — 组件级样式隔离（`<style scoped>`）
- 全站统一暗色科技风调色板

### 单元测试

测试基于 **Vitest** + **Vue Test Utils** + **happy-dom**：

```bash
npm run test
```

现有测试覆盖：

- `DeviceCard.spec.ts` — 设备卡片渲染和交互
- `TaskQueue.spec.ts` — 任务队列渲染和操作
- `LogViewer.spec.ts` — 日志终端渲染和功能
- `stores/devices.spec.ts` — 设备 Store 逻辑

---

## 构建部署

### 生产构建

```bash
npm run build
```

该命令会依次执行：

1. `vue-tsc -b` — TypeScript 类型检查
2. `vite build` — Vite 生产构建

### 构建产物

构建结果输出至 `dist/` 目录：

```
dist/
├── index.html
├── assets/
│   ├── index-xxx.js        # 主入口 JS
│   ├── index-xxx.css       # 样式文件
│   └── vendor-xxx.js       # 第三方依赖（Vue、Pinia、Router 等）
└── favicon.ico
```

### 部署方式

构建产物为纯静态文件，可部署至任意 HTTP 服务器（Nginx、Apache、Caddy 等）。

**Nginx 配置示例：**

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /path/to/dist;
    index index.html;

    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://localhost:8000;
    }

    # WebSocket 反向代理
    location /ws/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

> **提示**：生产部署时，`/api/` 和 `/ws/` 的反向代理需要指向后端 coin11-tb 服务。

---

## 许可协议

本项目基于 **MIT License** 开源。

---

*Coin11-TB 控制平台前端 — 构建高效、直观的 Android 自动化设备管理体验。*
