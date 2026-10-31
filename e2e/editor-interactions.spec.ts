import { expect, test } from '@playwright/test'
import {
  box,
  captureBrowserFailures,
  center,
  domNode,
  editorToolbar,
  graphStats,
  inputPort,
  outputPort,
  panelValue,
  runsPointerGestures,
} from './support/playground'

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!runsPointerGestures(testInfo), 'Pointer gestures run on desktop layouts.')
  await page.goto('/')
  await expect(domNode(page, '提示词')).toBeVisible()
})

test('drags a DOM node by its header and keeps it selected', async ({ page }) => {
  const failures = captureBrowserFailures(page)
  const header = domNode(page, '提示词').locator('.nw-default-dom-node__header')
  const before = await box(header)

  await page.mouse.move(before.x + 40, before.y + before.height / 2)
  await page.mouse.down()
  await page.mouse.move(before.x + 120, before.y + before.height / 2 + 60, { steps: 6 })
  await page.mouse.up()

  const after = await box(header)

  expect(after.x - before.x).toBeGreaterThan(60)
  expect(after.y - before.y).toBeGreaterThan(40)
  await expect(domNode(page, '提示词')).toHaveClass(/nw-default-dom-node--selected/u)
  await expect(panelValue(page, '选中项')).toHaveText('prompt')
  expect(failures).toEqual([])
})

test('undoes and redoes a node drag from the toolbar', async ({ page }) => {
  const failures = captureBrowserFailures(page)
  const header = domNode(page, '提示词').locator('.nw-default-dom-node__header')
  const undo = editorToolbar(page).getByRole('button', { name: '撤销' })
  const redo = editorToolbar(page).getByRole('button', { name: '重做' })
  const before = await box(header)

  await expect(undo).toBeDisabled()
  await page.mouse.move(before.x + 40, before.y + before.height / 2)
  await page.mouse.down()
  await page.mouse.move(before.x + 140, before.y + before.height / 2, { steps: 6 })
  await page.mouse.up()
  await expect.poll(async () => (await box(header)).x - before.x).toBeGreaterThan(80)

  await undo.click()
  await expect.poll(async () => (await box(header)).x).toBeCloseTo(before.x, 0)
  await expect(undo).toBeDisabled()
  await redo.click()
  await expect.poll(async () => (await box(header)).x - before.x).toBeGreaterThan(80)
  await expect(redo).toBeDisabled()
  expect(failures).toEqual([])
})

test('pans the canvas from the background and zooms with the wheel', async ({ page }) => {
  const failures = captureBrowserFailures(page)
  const surface = page.locator('.nw-canvas-surface')
  const area = await box(surface)
  const before = await box(domNode(page, '提示词'))
  // Empty canvas below the fitted graph, clear of the floating panels and the minimap.
  const start = { x: area.x + area.width / 2, y: area.y + area.height - 140 }

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 100, start.y + 50, { steps: 6 })
  await page.mouse.up()

  const panned = await box(domNode(page, '提示词'))

  expect(panned.x - before.x).toBeCloseTo(100, 0)
  expect(panned.y - before.y).toBeCloseTo(50, 0)

  await page.mouse.move(panned.x + 10, panned.y + 10)
  await page.mouse.wheel(0, -400)
  await expect
    .poll(async () => (await box(domNode(page, '提示词'))).width)
    .toBeGreaterThan(panned.width * 1.2)
  expect(failures).toEqual([])
})

test('edits a parameter through the default node field', async ({ page }) => {
  const failures = captureBrowserFailures(page)
  const textarea = domNode(page, '提示词').locator('textarea')

  await textarea.click()
  await textarea.fill('a quiet harbor at dusk')
  await editorToolbar(page).getByRole('button', { name: '适配' }).click()

  await expect(textarea).toHaveValue('a quiet harbor at dusk')
  await expect(page.locator('.runtime-panel__params')).toContainText('a quiet harbor at dusk')
  expect(failures).toEqual([])
})

test('disconnects an edge and reconnects it by dragging between ports', async ({ page }) => {
  const failures = captureBrowserFailures(page)
  const source = await center(outputPort(domNode(page, '提示词')))
  const target = await center(inputPort(domNode(page, '生成图片')).first())

  // The edge leaves and enters its ports horizontally, so it passes through their midpoint.
  await page.mouse.click((source.x + target.x) / 2, (source.y + target.y) / 2, { button: 'right' })
  await expect(graphStats(page)).toContainText('2 条连线')

  await page.mouse.move(source.x, source.y)
  await page.mouse.down()
  await page.mouse.move((source.x + target.x) / 2, source.y + 40, { steps: 5 })
  await page.mouse.move(target.x, target.y, { steps: 5 })
  await page.mouse.up()
  await expect(graphStats(page)).toContainText('3 条连线')
  expect(failures).toEqual([])
})

test('creates a connected node from a connection released on the canvas', async ({ page }) => {
  const failures = captureBrowserFailures(page)
  const source = await center(outputPort(domNode(page, '提示词')))

  await page.mouse.move(source.x, source.y)
  await page.mouse.down()
  await page.mouse.move(source.x + 40, source.y + 300, { steps: 8 })
  await page.mouse.up()

  const menu = page.locator('.connection-create-menu')

  await expect(menu.getByRole('button')).toHaveText([/^生成图片/u, /^数据预览/u])
  await menu.getByRole('button', { name: /数据预览/u }).click()
  await expect(menu).toHaveCount(0)
  await expect(graphStats(page)).toContainText('5 个节点')
  await expect(graphStats(page)).toContainText('4 条连线')
  await expect(domNode(page, '数据预览')).toHaveClass(/nw-default-dom-node--selected/u)
  expect(failures).toEqual([])
})
