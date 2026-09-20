import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * 界面确认检查清单
 *
 * 与原先手工执行的确认环节一一对应：
 *   1. 起服务后页面可访问，主布局渲染完成
 *   2. 布局形态与视口匹配（窄屏=移动头部，宽屏=侧边栏）
 *   3. 页面无横向溢出
 *   4. 会话列表面板（窄屏抽屉 / 宽屏侧栏）可打开且不挤坏布局
 *   5. 设置面板可打开、内容完整、可关闭
 *   6. 模板面板可打开、列表渲染、可关闭
 *   7. 主聊天区与输入区不被挤压
 *
 * 同一份清单在「窄屏 375×812」与「宽屏 1440×900」两个 project 下各跑一遍，
 * 两种布局必须得到同样的结论。
 *
 * 每个用例都是全新的浏览器上下文（localStorage 为空），
 * 不携带上一回运行的任何中间结果。
 */

type LayoutKind = 'narrow' | 'wide';

/** 当前用例运行的布局形态（由 playwright.config.ts 中项目的 metadata 注入） */
function layoutKind(): LayoutKind {
  return test.info().project.metadata.layout === 'narrow' ? 'narrow' : 'wide';
}

/** 断言页面没有横向溢出（出现横向滚动条即视为布局被挤坏） */
async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const size = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(
    size.scroll,
    `页面横向溢出：scrollWidth=${size.scroll} 超过 clientWidth=${size.client}`,
  ).toBeLessThanOrEqual(size.client);
}

/** 断言元素的渲染区域完整落在视口内（轮询等待抽屉滑入等动画结束后再判定） */
async function expectWithinViewport(page: Page, locator: Locator, name: string): Promise<void> {
  const viewport = page.viewportSize();
  if (!viewport) {
    throw new Error('无法读取视口尺寸');
  }
  await expect(async () => {
    const box = await locator.boundingBox();
    if (!box) {
      throw new Error(`${name} 没有可见的渲染区域`);
    }
    expect(box.x, `${name} 左边缘被挤出视口（x=${Math.round(box.x)}）`).toBeGreaterThanOrEqual(-1);
    expect(box.y, `${name} 上边缘被挤出视口（y=${Math.round(box.y)}）`).toBeGreaterThanOrEqual(-1);
    expect(
      box.x + box.width,
      `${name} 右边缘被挤出视口（${Math.round(box.x + box.width)} > ${viewport.width}）`,
    ).toBeLessThanOrEqual(viewport.width + 1);
    expect(
      box.y + box.height,
      `${name} 下边缘被挤出视口（${Math.round(box.y + box.height)} > ${viewport.height}）`,
    ).toBeLessThanOrEqual(viewport.height + 1);
  }).toPass({ timeout: 5_000 });
}

/** 指定 className 的 antd Drawer 内容节点（自定义 className 落在 dialog 内容上） */
function drawerContent(page: Page, className: string): Locator {
  return page.locator(`.ant-drawer-content.${className}`);
}

/** 指定 className 的 antd Drawer 根节点（open 状态体现在根节点的 ant-drawer-open 上） */
function drawerRoot(page: Page, className: string): Locator {
  return page.locator(`.ant-drawer:has(.ant-drawer-content.${className})`);
}

/** 断言指定 className 的 antd Drawer 已打开且内容已渲染 */
async function expectDrawerOpen(page: Page, className: string, name: string): Promise<void> {
  await expect(drawerRoot(page, className), `${name} 未打开`).toHaveClass(/ant-drawer-open/);
  await expect(drawerContent(page, className), `${name} 内容未渲染`).toBeVisible();
}

/** 断言指定 className 的 antd Drawer 已关闭 */
async function expectDrawerClosed(page: Page, className: string, name: string): Promise<void> {
  await expect(drawerRoot(page, className), `${name} 未关闭`).not.toHaveClass(/ant-drawer-open/);
}

test.describe('界面确认检查流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.app-layout')).toBeVisible();
  });

  test('1. 起服务后页面可访问，主布局渲染完成', async ({ page }) => {
    await test.step('页面标题与主容器就绪', async () => {
      await expect(page).toHaveTitle('React Chat Interface');
      await expect(page.locator('.chat-area')).toBeVisible();
    });
    await test.step('未触发错误边界', async () => {
      await expect(page.getByText('应用出错了')).toHaveCount(0);
    });
  });

  test('2. 布局形态与视口匹配', async ({ page }) => {
    if (layoutKind() === 'narrow') {
      await test.step('窄屏：显示移动端头部与菜单按钮，侧边栏不直接渲染', async () => {
        await expect(page.locator('.mobile-header')).toBeVisible();
        await expect(page.locator('.menu-button')).toBeVisible();
        await expect(page.locator('.sidebar')).toHaveCount(0);
      });
    } else {
      await test.step('宽屏：侧边栏直接可见，无移动端头部', async () => {
        await expect(page.locator('.sidebar')).toBeVisible();
        await expect(page.locator('.mobile-header')).toHaveCount(0);
      });
    }
  });

  test('3. 页面无横向溢出', async ({ page }) => {
    await expectNoHorizontalOverflow(page);
  });

  test('4. 会话列表面板可打开且不挤坏布局', async ({ page }) => {
    if (layoutKind() === 'narrow') {
      await test.step('点击菜单按钮打开移动端抽屉', async () => {
        await page.locator('.menu-button').click();
        await expectDrawerOpen(page, 'mobile-drawer', '移动端抽屉');
      });
      await test.step('抽屉内会话列表完整且在视口内', async () => {
        const drawer = drawerContent(page, 'mobile-drawer');
        await expect(drawer.locator('.sidebar')).toBeVisible();
        await expect(drawer.getByRole('button', { name: '新建对话' })).toBeVisible();
        await expectWithinViewport(page, drawer, '移动端抽屉');
      });
      await test.step('关闭抽屉后布局恢复', async () => {
        // 点击遮罩（抽屉未覆盖的右侧区域）关闭抽屉
        await drawerRoot(page, 'mobile-drawer')
          .locator('.ant-drawer-mask')
          .click({ position: { x: 360, y: 400 } });
        await expectDrawerClosed(page, 'mobile-drawer', '移动端抽屉');
        await expectNoHorizontalOverflow(page);
      });
    } else {
      await test.step('宽屏侧边栏完整且在视口内', async () => {
        const sidebar = page.locator('.sidebar');
        await expect(sidebar).toBeVisible();
        await expect(sidebar.getByRole('button', { name: '新建对话' })).toBeVisible();
        await expectWithinViewport(page, sidebar, '宽屏侧边栏');
      });
    }
  });

  test('5. 设置面板可打开、内容完整、可关闭', async ({ page }) => {
    await test.step('打开设置面板', async () => {
      if (layoutKind() === 'narrow') {
        // 窄屏下设置入口在移动端抽屉里的侧边栏中
        await page.locator('.menu-button').click();
        await expectDrawerOpen(page, 'mobile-drawer', '移动端抽屉');
      }
      await page.locator('.sidebar-actions button').click();
      await expectDrawerOpen(page, 'config-panel', '设置面板');
    });
    await test.step('设置项完整渲染且在视口内', async () => {
      const panel = drawerContent(page, 'config-panel');
      await expect(panel.locator('.ant-drawer-title')).toHaveText('设置');
      await expect(panel.getByText('API 配置')).toBeVisible();
      await expect(panel.getByText('模型设置')).toBeVisible();
      await expect(panel.getByText('参数调整')).toBeVisible();
      await expect(panel.locator('input[placeholder*="API Key"]')).toBeVisible();
      await expect(panel.locator('.ant-select')).toBeVisible();
      await expect(panel.locator('.ant-slider')).toHaveCount(2);
      await expectWithinViewport(page, panel, '设置面板');
    });
    await test.step('关闭设置面板', async () => {
      await drawerContent(page, 'config-panel').locator('.ant-drawer-close').click();
      await expectDrawerClosed(page, 'config-panel', '设置面板');
    });
  });

  test('6. 模板面板可打开、列表渲染、可关闭', async ({ page }) => {
    await test.step('打开提示词模板库', async () => {
      await page.locator('.template-library-btn').click();
      await expectDrawerOpen(page, 'prompt-template-drawer', '模板面板');
    });
    await test.step('模板列表渲染且在视口内', async () => {
      const panel = drawerContent(page, 'prompt-template-drawer');
      await expect(panel.locator('.ant-drawer-title')).toHaveText('提示词模板库');
      const cards = panel.locator('.template-card');
      await expect(cards.first()).toBeVisible();
      expect(await cards.count(), '模板库未渲染出任何模板卡片').toBeGreaterThan(0);
      await expectWithinViewport(page, panel, '模板面板');
    });
    await test.step('关闭模板面板', async () => {
      await drawerContent(page, 'prompt-template-drawer').locator('.ant-drawer-close').click();
      await expectDrawerClosed(page, 'prompt-template-drawer', '模板面板');
    });
  });

  test('7. 主聊天区与输入区不被挤压', async ({ page }) => {
    await test.step('输入区各控件完整可见', async () => {
      const inputArea = page.locator('.input-area');
      await expect(inputArea).toBeVisible();
      await expect(page.locator('.message-input')).toBeVisible();
      await expect(page.locator('.send-button')).toBeVisible();
      await expect(page.locator('.template-library-btn')).toBeVisible();
      await expectWithinViewport(page, inputArea, '输入区');
    });
    await test.step('输入框宽度未被挤压', async () => {
      const box = await page.locator('.message-input').boundingBox();
      if (!box) {
        throw new Error('输入框没有可见的渲染区域');
      }
      expect(box.width, `输入框宽度过窄（${Math.round(box.width)}px）`).toBeGreaterThan(120);
    });
    await test.step('页面无横向溢出', async () => {
      await expectNoHorizontalOverflow(page);
    });
  });
});
