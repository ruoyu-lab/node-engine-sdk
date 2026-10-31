import { expect, test, type Page } from '@playwright/test'
import {
  captureBrowserFailures,
  domNode,
  editorToolbar,
  graphStats,
  panelValue,
  scenarioNav,
  zoomControls,
} from './support/playground'

interface PrimitiveScenarioExpectation {
  title: string
  stats: [nodes: string, edges: string, groups: string]
  node: string
  outputs: Array<[label: string, value: string]>
  trace: number
  /** A text field whose parameter port is connected: it shows the upstream run value. */
  connectedField?: { node: string; before: string; after: string }
}

/** The four primitive scenarios of the shared registry and their deterministic run results. */
const primitiveScenarios: PrimitiveScenarioExpectation[] = [
  {
    title: '数据流管线',
    stats: ['5 个节点', '4 条连线', '1 个分组'],
    node: '转为字符串',
    outputs: [['预览', '["node-wright","42"]']],
    trace: 5,
  },
  {
    title: '审批发布流程',
    stats: ['10 个节点', '9 条连线', '1 个分组'],
    node: '审批分支',
    outputs: [
      ['发布日志', '测试版发布说明'],
      ['驳回日志', '未执行'],
    ],
    trace: 9,
    connectedField: { node: '发布日志', before: '', after: '测试版发布说明' },
  },
  {
    title: '函数调用链',
    stats: ['4 个节点', '3 条连线', '1 个分组'],
    node: '格式化问候',
    outputs: [['预览', '你好，Node Wright！（15 字）']],
    trace: 6,
  },
  {
    title: '子图复用',
    stats: ['6 个节点', '5 条连线', '1 个分组'],
    node: '包装副标题',
    outputs: [['预览', '["《Node Wright》","《子图指南》"]']],
    trace: 14,
  },
]

async function selectScenario(page: Page, title: string): Promise<void> {
  const item = scenarioNav(page).getByRole('button', { name: title })

  await item.click()
  await expect(item).toHaveAttribute('aria-current', 'true')
  await expect(page.locator('.runtime-panel__heading h2')).toHaveText(title)
}

async function expectOutputs(page: Page, outputs: Array<[string, string]>): Promise<void> {
  await expect(page.locator('.runtime-panel__outputs li strong')).toHaveText(
    outputs.map(([label]) => label),
  )
  await expect(page.locator('.runtime-panel__outputs li span')).toHaveText(
    outputs.map(([, value]) => value),
  )
}

for (const scenario of primitiveScenarios) {
  test(`switches to the ${scenario.title} primitive scenario and runs it`, async ({ page }) => {
    const failures = captureBrowserFailures(page)

    await page.goto('/')
    await selectScenario(page, scenario.title)

    for (const stat of scenario.stats) {
      await expect(graphStats(page)).toContainText(stat)
    }

    await expectOutputs(
      page,
      scenario.outputs.map(([label]) => [label, '等待运行']),
    )
    await editorToolbar(page).getByRole('button', { name: '适配' }).click()
    await expect(domNode(page, scenario.node)).toBeVisible()

    if (scenario.connectedField) {
      await expect(domNode(page, scenario.connectedField.node).locator('input')).toHaveValue(
        scenario.connectedField.before,
      )
    }

    await editorToolbar(page).getByRole('button', { name: '运行' }).click()

    await expect(panelValue(page, '运行时')).toHaveText('成功')
    await expectOutputs(page, scenario.outputs)
    await expect(panelValue(page, '运行结果')).toHaveText(
      String(scenario.outputs.filter(([, value]) => value !== '未执行').length),
    )
    await expect(panelValue(page, '执行轨迹')).toHaveText(String(scenario.trace))
    await expect(page.locator('.runtime-panel__trace li')).toHaveCount(scenario.trace)

    if (scenario.connectedField) {
      await expect(domNode(page, scenario.connectedField.node).locator('input')).toHaveValue(
        scenario.connectedField.after,
      )
    }

    expect(failures).toEqual([])
  })
}

test('starts each selected scenario with its own run, history and fitted view', async ({
  page,
}) => {
  const failures = captureBrowserFailures(page)
  const undo = editorToolbar(page).getByRole('button', { name: '撤销' })
  const zoom = page.locator('.app-shell__zoom')

  await page.goto('/')
  await selectScenario(page, '数据流管线')

  // Each mounted scenario starts fitted into the area the panels leave free.
  const fittedZoom = await zoom.textContent()

  await editorToolbar(page).getByRole('button', { name: '运行' }).click()
  await expect(panelValue(page, '运行时')).toHaveText('成功')
  await editorToolbar(page).getByRole('button', { name: '自动布局' }).click()
  await expect(undo).toBeEnabled()
  await zoomControls(page).getByRole('button', { name: '放大' }).click()
  await expect(zoom).not.toHaveText(fittedZoom ?? '')

  await selectScenario(page, '审批发布流程')
  await expect(undo).toBeDisabled()
  await expect(panelValue(page, '运行时')).toHaveText('空闲')
  await expect(panelValue(page, '执行轨迹')).toHaveText('0')
  await expectOutputs(page, [
    ['发布日志', '等待运行'],
    ['驳回日志', '等待运行'],
  ])

  await selectScenario(page, '数据流管线')
  await expect(zoom).toHaveText(fittedZoom ?? '')
  await expect(undo).toBeDisabled()

  await selectScenario(page, 'AI 图片生成')
  await expect(graphStats(page)).toContainText('4 个节点')
  await expect(domNode(page, '提示词')).toBeAttached()
  await expectOutputs(page, [['图片地址', '等待运行']])
  expect(failures).toEqual([])
})
