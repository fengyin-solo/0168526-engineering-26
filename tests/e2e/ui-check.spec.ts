import { test, expect, Page } from '@playwright/test';

/**
 * 界面确认流程：窄屏（mobile）与宽屏（desktop）跑完全相同的步骤，
 * 任何一步失败都能从报告中直接看到步骤名与原因。
 *
 * 每个用例都在全新的浏览器上下文中运行（Playwright 默认行为），
 * 并在页面脚本执行前清空 localStorage，保证不携带上一轮的中间结果。
 *
 * 注：antd v5 的 Drawer className 挂在内部 content 节点上，
 * 因此用 `.ant-drawer:has(<content>)` 定位抽屉根节点。
 */

/** 断言页面没有出现横向溢出（布局被挤坏的典型信号） */
async function expectNoHorizontalOverflow(page: Page, stage: string) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    scrollWidth,
    `${stage}：页面出现横向溢出（scrollWidth=${scrollWidth} > clientWidth=${clientWidth}）`,
  ).toBeLessThanOrEqual(clientWidth);
}

/** 断言抽屉已打开且完全落在视口内，没有被挤出屏幕 */
async function expectDrawerOpenWithinViewport(page: Page, contentSelector: string, stage: string) {
  const root = page.locator(`.ant-drawer:has(${contentSelector})`);
  await expect(root, `${stage}：抽屉未打开`).toHaveClass(/ant-drawer-open/);
  const content = page.locator(contentSelector).first();
  await expect(content, `${stage}：抽屉内容未出现`).toBeVisible();
  const viewport = page.viewportSize();
  // 抽屉有滑入动画，轮询直到位置稳定且落入视口
  await expect(async () => {
    const box = await content.boundingBox();
    expect(box, `${stage}：无法获取抽屉位置`).not.toBeNull();
    expect(
      box!.x,
      `${stage}：抽屉左缘超出屏幕（x=${box!.x.toFixed(0)} < 0）`,
    ).toBeGreaterThanOrEqual(0);
    expect(
      box!.x + box!.width,
      `${stage}：抽屉右缘超出屏幕（右缘=${(box!.x + box!.width).toFixed(0)} > 视口宽=${viewport!.width}）`,
    ).toBeLessThanOrEqual(viewport!.width);
  }, `${stage}：抽屉在动画结束后仍未落入视口`).toPass({ timeout: 15_000 });
}

/** 断言抽屉已关闭 */
async function expectDrawerClosed(page: Page, contentSelector: string, stage: string) {
  const root = page.locator(`.ant-drawer:has(${contentSelector})`);
  await expect(root, `${stage}：抽屉未能关闭`).not.toHaveClass(/ant-drawer-open/);
}

/** 点击遮罩关闭移动端抽屉（比 Escape 可靠，不依赖焦点位置） */
async function closeMobileDrawerByMask(page: Page) {
  const mask = page.locator('.ant-drawer:has(.mobile-drawer) .ant-drawer-mask');
  const box = await mask.boundingBox();
  // 抽屉宽 80%，点遮罩最右侧未被抽屉覆盖的区域
  await mask.click({ position: { x: box!.width - 5, y: box!.height / 2 } });
}

test.beforeEach(async ({ page }) => {
  // 页面脚本运行前清空本地存储，确保每回检查都从干净状态开始
  await page.addInitScript(() => window.localStorage.clear());
});

test('界面确认流程', async ({ page }, testInfo) => {
  const isMobile = testInfo.project.name === 'mobile';

  await test.step('服务可访问，页面加载完成', async () => {
    const response = await page.goto('/');
    expect(response?.ok(), `服务响应异常：HTTP ${response?.status()}`).toBeTruthy();
    await expect(page.locator('.app-layout')).toBeVisible();
    await expect(page.locator('.input-area')).toBeVisible();
  });

  await test.step('整体布局无横向溢出', async () => {
    await expectNoHorizontalOverflow(page, '初始布局');
  });

  await test.step(isMobile ? '窄屏：显示移动端头部与菜单按钮，隐藏桌面侧边栏' : '宽屏：显示桌面侧边栏，无移动端头部', async () => {
    if (isMobile) {
      await expect(page.locator('.mobile-header')).toBeVisible();
      await expect(page.locator('.menu-button')).toBeVisible();
      await expect(page.locator('.app-content .sidebar')).toHaveCount(0);
    } else {
      await expect(page.locator('.app-content .sidebar')).toBeVisible();
      await expect(page.locator('.mobile-header')).toHaveCount(0);
    }
  });

  if (isMobile) {
    await test.step('窄屏：抽屉可打开、内容完整、可关闭', async () => {
      await page.locator('.menu-button').click();
      await expectDrawerOpenWithinViewport(page, '.mobile-drawer', '移动端抽屉');
      await expect(page.locator('.mobile-drawer .sidebar-title')).toHaveText('对话历史');
      await expect(page.locator('.mobile-drawer .sidebar-new button')).toBeVisible();
      await expectNoHorizontalOverflow(page, '抽屉打开后');
      await closeMobileDrawerByMask(page);
      await expectDrawerClosed(page, '.mobile-drawer', '移动端抽屉');
    });
  }

  await test.step('设置面板可打开、三段内容完整、可关闭', async () => {
    if (isMobile) {
      // 窄屏下设置入口在抽屉里
      await page.locator('.menu-button').click();
      await expectDrawerOpenWithinViewport(page, '.mobile-drawer', '移动端抽屉');
      await page.locator('.mobile-drawer .sidebar-actions button').click();
    } else {
      await page.locator('.app-content .sidebar-actions button').click();
    }
    await expectDrawerOpenWithinViewport(page, '.config-panel', '设置面板');
    await expect(page.locator('.config-panel .ant-drawer-title')).toHaveText('设置');
    await expect(page.locator('.config-panel .section-title', { hasText: 'API 配置' })).toBeVisible();
    await expect(page.locator('.config-panel .section-title', { hasText: '模型设置' })).toBeVisible();
    await expect(page.locator('.config-panel .section-title', { hasText: '参数调整' })).toBeVisible();
    await expectNoHorizontalOverflow(page, '设置面板打开后');
    await page.locator('.config-panel .ant-drawer-close').click();
    await expectDrawerClosed(page, '.config-panel', '设置面板');
    if (isMobile) {
      // 收起底层的移动端抽屉，恢复干净状态
      await closeMobileDrawerByMask(page);
      await expectDrawerClosed(page, '.mobile-drawer', '移动端抽屉');
    }
  });

  await test.step('模板库可打开、内容完整、可关闭', async () => {
    await page.locator('.template-library-btn').click();
    await expectDrawerOpenWithinViewport(page, '.prompt-template-drawer', '模板库');
    await expect(page.locator('.prompt-template-drawer .ant-drawer-title')).toHaveText('提示词模板库');
    await expectNoHorizontalOverflow(page, '模板库打开后');
    await page.locator('.prompt-template-drawer .ant-drawer-close').click();
    await expectDrawerClosed(page, '.prompt-template-drawer', '模板库');
  });

  await test.step('收尾：所有面板关闭后布局仍无横向溢出', async () => {
    await expectNoHorizontalOverflow(page, '收尾检查');
  });
});
