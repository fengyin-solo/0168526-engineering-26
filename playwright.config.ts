import { defineConfig, devices } from '@playwright/test';

/**
 * UI 回归检查流水线
 *
 * 一条命令串起整个确认流程：
 *   1. 自动构建并启动生产服务（webServer）
 *   2. 窄屏（mobile 375x812）与宽屏（desktop 1280x800）两个项目跑同一套用例
 *   3. 逐步检查：布局无横向溢出 → 抽屉 → 设置面板 → 模板库
 *
 * 每一步都有独立超时与名称，任何一步失败都能在报告里直接看到
 * 是哪一步、什么原因。每个用例都在全新的浏览器上下文里运行，
 * 不携带上一轮的 localStorage / 会话状态，可反复执行。
 */
export default defineConfig({
  testDir: './tests/e2e',
  // 单步超时：任何一步超过 15s 即判失败并指出步骤名
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // 失败即停太重，这里不重试，保证结论就是当次真实结果
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 } },
    },
  ],
  webServer: {
    // 基于生产构建起服务，避免 dev 模式的差异
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
