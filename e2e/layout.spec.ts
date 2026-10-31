import { expect, test, type Page } from '@playwright/test'
import {
  box,
  captureBrowserFailures,
  domNode,
  editorToolbar,
  panelValue,
  runsPhoneLayout,
  runsPointerGestures,
  scenarioNav,
  stubImageService,
  zoomControls,
} from './support/playground'

/** The editor's pan offset, read from the transform of its DOM node layer. */
async function readPan(page: Page): Promise<{ x: number; y: number }> {
  const transform = await page.locator('.nw-dom-node-layer').evaluate((layer) => {
    return (layer as HTMLElement).style.transform
  })
  const match = /translate3?d?\(([-\d.]+)px, ([-\d.]+)px/u.exec(transform)

  if (!match) {
    throw new Error(`Unexpected DOM layer transform "${transform}".`)
  }

  return { x: Number(match[1]), y: Number(match[2]) }
}

test.describe('minimap', () => {
  test.beforeEach(({ page: _page }, testInfo) => {
    test.skip(!runsPointerGestures(testInfo), 'The minimap is driven by pointer on desktop.')
  })

  test('shows the graph and the visible area and pans the canvas from it', async ({ page }) => {
    const failures = captureBrowserFailures(page)
    const minimap = page.locator('.nw-minimap')

    await page.goto('/')
    await expect(domNode(page, '提示词')).toBeVisible()
    await expect(minimap).toBeVisible()
    await expect(minimap.locator('canvas.nw-minimap__canvas')).toBeAttached()

    const frame = await box(minimap)
    const visibleArea = await box(minimap.locator('.nw-minimap__viewport'))

    expect(visibleArea.width).toBeGreaterThan(0)
    expect(visibleArea.width).toBeLessThanOrEqual(frame.width + 1)

    // Once the visible area is smaller than the graph, it shrinks inside the minimap.
    for (let step = 0; step < 4; step += 1) {
      await zoomControls(page).getByRole('button', { name: '放大' }).click()
    }

    await expect
      .poll(async () => (await box(minimap.locator('.nw-minimap__viewport'))).width)
      .toBeLessThan(visibleArea.width * 0.8)

    // A click centres the canvas on the clicked point.
    const before = await readPan(page)

    await page.mouse.click(frame.x + frame.width - 12, frame.y + frame.height / 2)
    await expect.poll(async () => (await readPan(page)).x).toBeLessThan(before.x - 20)

    // Dragging keeps panning while the pointer moves.
    const clicked = await readPan(page)
    const area = await box(minimap.locator('.nw-minimap__viewport'))

    await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2)
    await page.mouse.down()
    await page.mouse.move(area.x + area.width / 2 - 30, area.y + area.height / 2, { steps: 5 })
    await page.mouse.up()
    await expect.poll(async () => (await readPan(page)).x).toBeGreaterThan(clicked.x + 20)

    // Arrow keys pan the canvas while the minimap has focus.
    const dragged = await readPan(page)

    await minimap.focus()
    await page.keyboard.press('ArrowDown')
    await expect.poll(async () => (await readPan(page)).y).toBeLessThan(dragged.y)
    expect(failures).toEqual([])
  })
})

test.describe('panels', () => {
  test('collapses the scenario list to a rail and the run panel to its header', async ({
    page,
  }, testInfo) => {
    test.skip(runsPhoneLayout(testInfo), 'Phones show the scenarios as a top bar.')
    const failures = captureBrowserFailures(page)
    const sidebar = page.locator('.demo-sidebar')
    const panel = page.locator('.runtime-panel')

    await page.goto('/')

    const expandNav = page.getByRole('button', { name: '展开场景列表' })
    const collapseNav = page.getByRole('button', { name: '收起场景列表' })

    if (await expandNav.isVisible()) {
      await expandNav.click()
    }

    await expect(collapseNav).toHaveAttribute('aria-expanded', 'true')
    await expect.poll(async () => (await box(sidebar)).width).toBeGreaterThan(200)
    const expandedWidth = (await box(sidebar)).width

    await collapseNav.click()
    await expect(sidebar).toHaveClass(/demo-sidebar--collapsed/u)
    await expect.poll(async () => (await box(sidebar)).width).toBeLessThan(expandedWidth / 2)

    // The rail keeps every scenario reachable by name.
    await scenarioNav(page).getByRole('button', { name: '函数调用链' }).click()
    await expect(page.locator('.runtime-panel__heading h2')).toHaveText('函数调用链')

    const openPanel = page.getByRole('button', { name: '展开运行面板' })

    if (await openPanel.isVisible()) {
      await openPanel.click()
    }

    await expect(page.locator('#runtime-panel-body')).toBeVisible()
    await page.getByRole('button', { name: '收起运行面板' }).click()
    await expect(panel).toHaveClass(/runtime-panel--collapsed/u)
    await expect(page.locator('#runtime-panel-body')).toBeHidden()
    await expect(panel.locator('.runtime-panel__status')).toHaveText('空闲')
    expect(failures).toEqual([])
  })
})

test.describe('phone layout', () => {
  test.beforeEach(({ page: _page }, testInfo) => {
    test.skip(!runsPhoneLayout(testInfo), 'Only phones use the compact layout.')
  })

  test('keeps the compact toolbar and the bottom drawer usable', async ({ page }) => {
    const failures = captureBrowserFailures(page)
    const viewport = page.viewportSize()!
    const drawer = page.locator('.runtime-panel')

    await stubImageService(page)
    await page.goto('/')
    await expect(domNode(page, '提示词')).toBeAttached()

    // Every toolbar button fits on screen and the minimap gives way to the drawer.
    for (const button of await editorToolbar(page).getByRole('button').all()) {
      const bounds = await box(button)

      expect(bounds.x).toBeGreaterThanOrEqual(0)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width)
      expect(bounds.height).toBeGreaterThanOrEqual(32)
    }

    await expect(page.locator('.nw-minimap')).toBeHidden()
    await expect(zoomControls(page)).toBeVisible()

    // The drawer starts as a header at the bottom of the screen.
    await expect(drawer).toHaveClass(/runtime-panel--collapsed/u)
    expect((await box(drawer)).y + (await box(drawer)).height).toBeCloseTo(viewport.height, 0)

    await editorToolbar(page).getByRole('button', { name: '运行' }).click()
    await expect(drawer.locator('.runtime-panel__status')).toHaveText('成功')

    await page.getByRole('button', { name: '展开运行面板' }).click()
    await expect(page.locator('#runtime-panel-body')).toBeVisible()
    await expect(panelValue(page, '运行结果')).toHaveText('1')
    await expect(page.locator('.runtime-panel__outputs li span')).toBeVisible()
    await expect(zoomControls(page)).toBeHidden()

    await page.getByRole('button', { name: '收起运行面板' }).click()
    await expect(page.locator('#runtime-panel-body')).toBeHidden()

    // Scenarios scroll in the top bar.
    await scenarioNav(page).getByRole('button', { name: '子图复用' }).click()
    await expect(page.locator('.runtime-panel__heading h2')).toHaveText('子图复用')
    expect(failures).toEqual([])
  })
})
