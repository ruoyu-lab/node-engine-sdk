import { readFile, writeFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import {
  captureBrowserFailures,
  domNode,
  editorToolbar,
  graphStats,
  panelValue,
  stubImageService,
  zoomControls,
} from './support/playground'

interface ExportedGraph {
  nodes: Array<{ id: string }>
  edges: Array<{ id: string; source: { nodeId: string }; target: { nodeId: string } }>
  groups: Array<{ nodeIds?: string[] }>
}

async function readZoom(page: Page): Promise<number> {
  return Number.parseInt((await page.locator('.app-shell__zoom').textContent()) ?? '', 10)
}

test('keeps the standard preset usable at every supported viewport', async ({ page }) => {
  const failures = captureBrowserFailures(page)

  await page.goto('/')

  await expect(page.locator('.runtime-panel__heading h2')).toHaveText('AI 图片生成')
  await expect(page.locator('.runtime-panel__heading h2')).toBeVisible()
  await expect(page.locator('[role="application"]')).toBeVisible()

  await editorToolbar(page).getByRole('button', { name: '自动布局' }).click()
  await editorToolbar(page).getByRole('button', { name: '适配' }).click()

  await expect(page.locator('.ne-default-dom-node')).toHaveCount(4)
  await expect(domNode(page, '提示词')).toBeVisible()
  await expect(domNode(page, '生成图片')).toBeVisible()
  await expect(domNode(page, '固定种子')).toBeVisible()
  await expect(domNode(page, '图片预览')).toBeVisible()
  await expect(page.locator('.ai-image-display__badge')).toHaveText('等待运行')

  await editorToolbar(page).getByRole('button', { name: '重置' }).click()
  await expect(graphStats(page)).toContainText('4 个节点')
  await expect(graphStats(page)).toContainText('3 条连线')
  await expect(graphStats(page)).toContainText('1 个分组')
  expect(failures).toEqual([])
})

test('runs the complete AI image workflow with a deterministic network response', async ({
  page,
}) => {
  const failures = captureBrowserFailures(page)

  await stubImageService(page)
  await page.goto('/')

  await editorToolbar(page).getByRole('button', { name: '运行' }).click()

  await expect(panelValue(page, '运行时')).toHaveText('成功')
  await expect(panelValue(page, '执行轨迹')).toHaveText('4')
  await expect(panelValue(page, '事件')).toHaveText('4')
  await expect(page.locator('.runtime-panel__trace li')).toHaveCount(4)
  await expect(panelValue(page, '运行结果')).toHaveText('1')
  await expect(page.locator('.runtime-panel__outputs li span')).toHaveText(
    /^https:\/\/image\.pollinations\.ai\/prompt\//u,
  )
  // Every node the run reached shows its status on the canvas.
  await expect(page.locator('.ne-default-dom-node__status--success')).toHaveCount(4)
  await expect(page.locator('.runtime-panel__status')).toHaveText('成功')
  await editorToolbar(page).getByRole('button', { name: '适配' }).click()
  await expect(page.locator('.ne-default-dom-node__field-image-img')).toHaveAttribute(
    'src',
    /image\.pollinations\.ai/,
  )
  await expect(page.locator('.ai-image-display__badge')).toHaveText('1024 × 1024 · 种子 12345')

  // Resetting the scenario clears the run and the node statuses.
  await editorToolbar(page).getByRole('button', { name: '重置' }).click()
  await expect(panelValue(page, '运行时')).toHaveText('空闲')
  await expect(page.locator('.ne-default-dom-node__status')).toHaveCount(0)
  expect(failures).toEqual([])
})

test('switches the whole interface between the dark and the light theme', async ({ page }) => {
  const failures = captureBrowserFailures(page)
  const shell = page.locator('.app-shell')
  const editor = page.locator('.ne-root')
  const themeButton = editorToolbar(page).getByRole('button', { name: '浅色主题' })
  const background = () =>
    editor.evaluate((element) =>
      getComputedStyle(element).getPropertyValue('--ne-background').trim(),
    )

  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')

  await expect(shell).toHaveAttribute('data-theme', 'dark')
  await expect(editor).toHaveAttribute('data-color-scheme', 'dark')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(themeButton).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(background).toBe('#111214')

  await themeButton.click()
  await expect(themeButton).toHaveAttribute('aria-pressed', 'true')
  await expect(shell).toHaveAttribute('data-theme', 'light')
  await expect(editor).toHaveAttribute('data-color-scheme', 'light')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect.poll(background).toBe('#f5f6f8')
  await expect
    .poll(() => domNode(page, '提示词').evaluate((node) => getComputedStyle(node).backgroundColor))
    .toBe('rgb(255, 255, 255)')

  await themeButton.click()
  await expect(shell).toHaveAttribute('data-theme', 'dark')
  await expect(editor).toHaveAttribute('data-color-scheme', 'dark')
  await expect.poll(background).toBe('#111214')
  expect(failures).toEqual([])
})

test('starts in the theme the system prefers', async ({ page }) => {
  const failures = captureBrowserFailures(page)

  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')

  await expect(page.locator('.app-shell')).toHaveAttribute('data-theme', 'light')
  await expect(page.locator('.ne-root')).toHaveAttribute('data-color-scheme', 'light')
  await expect(editorToolbar(page).getByRole('button', { name: '浅色主题' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(failures).toEqual([])
})

test('zooms from the zoom controls and round-trips the graph through export and import', async ({
  page,
}, testInfo) => {
  const failures = captureBrowserFailures(page)

  await page.goto('/')
  await expect(domNode(page, '提示词')).toBeAttached()

  const initialZoom = await readZoom(page)

  await zoomControls(page).getByRole('button', { name: '放大' }).click()
  await expect.poll(() => readZoom(page)).toBeGreaterThan(initialZoom)
  await zoomControls(page).getByRole('button', { name: '缩小' }).click()
  await expect.poll(() => readZoom(page)).toBe(initialZoom)

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    editorToolbar(page).getByRole('button', { name: '导出' }).click(),
  ])
  const exported = JSON.parse(await readFile(await download.path(), 'utf8')) as ExportedGraph

  expect(download.suggestedFilename()).toBe('ai-image-workflow.json')
  expect(exported.nodes.map((node) => node.id)).toEqual([
    'prompt',
    'image-generate',
    'seed-value',
    'image-display',
  ])

  const withoutSeed: ExportedGraph = {
    ...exported,
    nodes: exported.nodes.filter((node) => node.id !== 'seed-value'),
    edges: exported.edges.filter(
      (edge) => edge.source.nodeId !== 'seed-value' && edge.target.nodeId !== 'seed-value',
    ),
    groups: exported.groups.map((group) => ({
      ...group,
      nodeIds: group.nodeIds?.filter((nodeId) => nodeId !== 'seed-value'),
    })),
  }
  const importPath = testInfo.outputPath('graph-without-seed.json')

  await writeFile(importPath, JSON.stringify(withoutSeed))
  await page.locator('.app-shell__file-input').setInputFiles(importPath)
  await expect(graphStats(page)).toContainText('3 个节点')
  await expect(graphStats(page)).toContainText('2 条连线')
  await expect(page.locator('.ne-default-dom-node')).toHaveCount(3)

  const invalidPath = testInfo.outputPath('invalid-graph.json')

  await writeFile(invalidPath, '{ "nodes": ')
  await page.locator('.app-shell__file-input').setInputFiles(invalidPath)
  await expect(page.locator('.runtime-panel__message--error')).toContainText('导入失败')
  await expect(graphStats(page)).toContainText('3 个节点')
  expect(failures).toEqual([])
})

test('lists the shortcuts and toggles the performance overlay', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.metadata.layout === 'mobile',
    'Phones have no keyboard shortcuts or performance overlay.',
  )
  const failures = captureBrowserFailures(page)
  const shortcuts = page.getByRole('button', { name: '快捷键', exact: true })
  const performance = page.getByRole('button', { name: '性能' })

  await page.goto('/')

  await expect(page.locator('#shortcut-hints')).toBeHidden()
  await shortcuts.click()
  await expect(shortcuts).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('.shortcut-hints__row')).toContainText(['平移画布'])
  await expect(page.locator('#shortcut-hints')).toContainText('撤销')
  await page.getByRole('button', { name: '关闭快捷键' }).click()
  await expect(page.locator('#shortcut-hints')).toBeHidden()

  await expect(page.locator('.ne-performance')).toHaveCount(0)
  await performance.click()
  await expect(performance).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.ne-performance')).toContainText('fps')
  await performance.click()
  await expect(page.locator('.ne-performance')).toHaveCount(0)
  expect(failures).toEqual([])
})
