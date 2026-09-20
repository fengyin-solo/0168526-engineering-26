import { defineConfig } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * 界面确认检查流程（E2E）
 *
 * 把原先手工的确认环节串成一条可反复执行的检查：
 *   起服务 → 窄屏/宽屏两套布局 → 抽屉 / 设置 / 模板面板逐个打开确认。
 *
 * - webServer 自动启动并回收 dev 服务，无需手工起服务；
 * - 窄屏（375×812）与宽屏（1440×900）两个 project 跑同一份检查清单，
 *   两种布局必须得到同样的结论才算通过；
 * - 每个用例对应清单中的一项，用例内每个确认环节是一个命名 step，
 *   任何一步超时或不通过，报告中都能直接看到是哪一步、什么原因；
 * - 每个用例使用全新的浏览器上下文（localStorage 为空），
 *   输出目录 test-results 在每次运行前自动清空，
 *   修好后重跑不会留下上一回的中间结果。
 */

const PORT = 5199;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * 无 root 权限的环境（无法执行 npx playwright install-deps）：
 * 把浏览器依赖库解压到 ~/browser-libs（或用 PLAYWRIGHT_CHROMIUM_LIBS 指向该目录），
 * 这里会自动把其中的库目录加入 LD_LIBRARY_PATH。
 * 常规环境（依赖已通过 install-deps 安装）下此逻辑不生效。
 */
function collectBrowserLibDirs(): string[] {
  const root = process.env.PLAYWRIGHT_CHROMIUM_LIBS ?? join(homedir(), 'browser-libs');
  if (!existsSync(root)) {
    return [];
  }
  const dirs: string[] = [];
  const walk = (dir: string, depth: number): void => {
    if (depth > 4) {
      return;
    }
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      const full = join(dir, entry.name);
      if (entry.name.includes('linux-gnu') || entry.name === 'lib') {
        dirs.push(full);
      }
      walk(full, depth + 1);
    }
  };
  walk(root, 0);
  return dirs;
}

const browserLibDirs = collectBrowserLibDirs();
if (browserLibDirs.length > 0) {
  process.env.LD_LIBRARY_PATH = [...browserLibDirs, process.env.LD_LIBRARY_PATH]
    .filter(Boolean)
    .join(':');
}

export default defineConfig({
  testDir: './tests/e2e',
  // 只匹配 *.check.ts，避免被 vitest 的默认规则（*.test/*.spec）误收
  testMatch: '**/*.check.ts',

  // 单个用例整体超时；超时报告会指明卡在哪一步
  timeout: 30_000,
  // 单条断言的最长等待时间
  expect: { timeout: 5_000 },

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // 不重试：任何失败立即暴露，不掩盖偶发问题
  retries: 0,

  // list：终端逐条列出每个检查项的通过/失败及原因
  // html：失败时可用 npm run test:e2e:report 查看带截图/轨迹的报告
  reporter: [['list'], ['html', { open: 'never' }]],

  // 每次运行前自动清空，不残留上一回的截图与轨迹
  outputDir: 'test-results',

  use: {
    baseURL: BASE_URL,
    actionTimeout: 10_000,
    // 失败时保留轨迹与截图，便于定位原因
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: '窄屏 375×812',
      use: {
        viewport: { width: 375, height: 812 },
        hasTouch: true,
      },
      metadata: { layout: 'narrow' },
    },
    {
      name: '宽屏 1440×900',
      use: {
        viewport: { width: 1440, height: 900 },
      },
      metadata: { layout: 'wide' },
    },
  ],

  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    timeout: 120_000,
    // 本地已有可用服务时直接复用；CI 上总是全新启动
    reuseExistingServer: !process.env.CI,
  },
});
