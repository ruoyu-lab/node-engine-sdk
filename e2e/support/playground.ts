import type { Locator, Page, TestInfo } from '@playwright/test'

/**
 * Helpers shared by the specs. Every spec runs against the Vue and the React playground; both
 * render the same markup, so selectors never depend on the app.
 */

export function captureBrowserFailures(page: Page): string[] {
  const failures: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      failures.push(`console:${message.type()}: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => {
    failures.push(`pageerror: ${error.message}`)
  })

  return failures
}

/** Pointer gestures run on desktop layouts, where the whole scenario fits beside the panels. */
export function runsPointerGestures(testInfo: TestInfo): boolean {
  return testInfo.project.metadata.layout === 'desktop'
}

/** Phones get the top bar, the compact toolbar and the bottom drawer. */
export function runsPhoneLayout(testInfo: TestInfo): boolean {
  return testInfo.project.metadata.layout === 'mobile'
}

/** Answers the image service with a tiny deterministic image instead of the network. */
export async function stubImageService(page: Page): Promise<void> {
  await page.route('https://image.pollinations.ai/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#7ab497"/></svg>',
    }),
  )
}

export async function box(locator: Locator) {
  const bounds = await locator.boundingBox()

  if (!bounds) {
    throw new Error('Element is not rendered.')
  }

  return bounds
}

export async function center(locator: Locator) {
  const bounds = await box(locator)

  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
}

export function domNode(page: Page, title: string): Locator {
  return page.locator('.nw-default-dom-node', {
    has: page.locator('.nw-default-dom-node__title', { hasText: title }),
  })
}

/** The floating toolbar: run, layout, fit, reset, history, import / export and theme. */
export function editorToolbar(page: Page): Locator {
  return page.getByRole('toolbar', { name: '画布操作' })
}

/** Zoom out, zoom readout and zoom in, next to the minimap. */
export function zoomControls(page: Page): Locator {
  return page.getByRole('group', { name: '缩放' })
}

export function scenarioNav(page: Page): Locator {
  return page.getByRole('navigation', { name: '演示场景' })
}

export function graphStats(page: Page): Locator {
  return page.locator('.runtime-panel__stats')
}

export function panelValue(page: Page, section: string): Locator {
  return page
    .locator('.runtime-panel__section-header')
    .filter({ hasText: section })
    .locator('strong')
}

export function outputPort(node: Locator): Locator {
  return node.locator('.nw-default-dom-node__port--right .nw-default-dom-node__port-dot')
}

export function inputPort(node: Locator): Locator {
  return node.locator('.nw-default-dom-node__port--left .nw-default-dom-node__port-dot')
}
