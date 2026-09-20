# React Chat Interface

基于 React 的 AI 聊天界面，提供类似 ChatGPT 的用户体验。

## How to Run

### Docker 部署（推荐）

```bash
# 构建并启动服务
docker-compose up --build -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f frontend-user

# 停止服务
docker-compose down
```

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 生产构建
npm run build
```

## Services

| 服务名称 | 端口 | 说明 |
|---------|------|------|
| frontend-user | 8081 | 前端用户端 - React Chat Interface |

访问地址：http://localhost:8081

## 测试账号

| 类型 | 值 |
|------|-----|
| API Key | `sk-buouxmhplmkqskzzcpmvixsttjzggzupfrkzpscfpwwqvucp` |
| 平台 | [SiliconFlow](https://siliconflow.com) |

> 注：请前往 SiliconFlow 平台(https://siliconflow.com) 注册并获取自己的 API Key

## 题目内容

请帮我设计一个基于React的类OpenAI聊天界面，需满足以下功能：

1. **用户配置模块**
   - 提供API Key输入框（支持本地存储，避免重复填写）
   - 支持选择siliconflow平台的模型和参数（temperature、max_tokens信息)

2. **对话交互界面**
   - 仿ChatGPT的聊天布局：左侧历史会话列表，右侧主聊天区
   - 支持多轮对话，保留上下文（通过messages数组传递历史记录）
   - 实现流式响应（逐字输出效果），使用Server-Sent Events或OpenAI的stream参数

3. **功能增强**
   - 消息Markdown渲染（代码高亮、链接解析等）
   - 一键复制回复内容
   - 响应耗时统计与token用量显示

4. **错误处理与状态管理**
   - 网络错误、API限流等异常提示
   - 加载状态动画（如发送中、流式响应时）

5. **技术栈建议**
   - UI库：Ant Design或Material-UI
   - 状态管理：Zustand或Context API
   - 流式处理：使用`openai`库的`stream`参数或自定义SSE连接

**附加要求：**
- 提供完整的React Hooks实现方案
- 优先考虑TypeScript类型安全
- 兼容移动端布局
- 提供完整的readme.md文档

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 18 + TypeScript |
| UI | Ant Design 5 |
| 状态管理 | Zustand 5 |
| API 调用 | OpenAI SDK |
| Markdown | react-markdown + rehype-highlight + remark-gfm |
| 构建工具 | Vite 5 |
| 测试 | Vitest + fast-check |

## 功能特性

- 多轮对话，完整上下文保留
- 流式响应，逐字输出效果
- Markdown 渲染，代码语法高亮
- 对话历史管理，本地持久化
- 响应式布局，移动端适配
- Token 用量统计，响应时间显示
- 一键复制回复内容

## API 配置

使用 SiliconFlow 平台 API 服务：

- **Base URL**: `https://api.siliconflow.com/v1`
- **支持模型**:
  - DeepSeek V3 (`deepseek-ai/DeepSeek-V3`)
  - Qwen 2.5 72B (`Qwen/Qwen2.5-72B-Instruct`)
  - Qwen 2.5 32B (`Qwen/Qwen2.5-32B-Instruct`)

## 目录结构

```
src/
├── components/       # UI 组件
│   ├── Chat/         # 聊天组件
│   ├── Sidebar/      # 侧边栏
│   ├── Config/       # 配置面板
│   ├── Common/       # 通用组件
│   └── Layout/       # 布局组件
├── stores/           # Zustand 状态管理
├── services/         # 服务层
├── hooks/            # 自定义 Hooks
├── types/            # TypeScript 类型
├── utils/            # 工具函数
└── styles/           # 全局样式
```

## 脚本命令

```bash
npm run dev          # 启动开发服务器
npm run build        # 生产构建
npm run preview      # 预览生产版本
npm run lint         # ESLint 检查
npm run test         # 运行测试
npm run check:ui     # 界面回归检查（见下节）
```

## 界面回归检查

每次改完界面后，一条命令跑完整套确认流程，替代手工逐项核对：

```bash
npm run check:ui          # 跑完整检查流程
npm run check:ui:report   # 查看上一次的 HTML 报告（含失败截图与 trace）
```

流程会自动完成以下步骤，任何一步失败都会指出**是哪一步、什么原因**，并以非零退出码结束：

1. 自动构建并启动生产服务（无需手工起服务）
2. 在**宽屏（1280×800）与窄屏（375×812）**两套视口下执行同一套检查，两边结论一致才算通过
3. 逐步确认：
   - 页面加载完成、整体布局无横向溢出
   - 视口专属元素正确（宽屏显示侧边栏 / 窄屏显示移动端头部与菜单按钮）
   - 窄屏抽屉：能打开、内容完整、在视口内、能关闭
   - 设置面板：能打开、API 配置 / 模型设置 / 参数调整三段完整、在视口内、能关闭
   - 模板库：能打开、内容完整、在视口内、能关闭
   - 收尾：所有面板关闭后布局仍无横向溢出

每个用例都在全新的浏览器上下文中运行，并在页面脚本执行前清空 localStorage，**不携带上一轮的中间结果**，修好后直接重跑即可。

### 环境准备

首次运行需要安装 Playwright 浏览器：

```bash
npx playwright install chromium        # 下载浏览器
npx playwright install-deps chromium   # 安装系统依赖（需要 root）
```

无 root 权限的环境（如部分容器）可改用本地依赖库：把缺失的 `.deb` 包解压到
`.browser-libs/root/`（保持 `usr/lib/...` 目录结构），`scripts/check-ui.sh`
会自动将其加入 `LD_LIBRARY_PATH`。

## License

MIT
