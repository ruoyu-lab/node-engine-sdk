// Regenerates the README screenshots and the demo GIF in docs/assets from the real Vue playground.
//
// Usage: node scripts/capture-readme-assets.mjs
// Needs: Playwright Chromium (`npx playwright install chromium`), `ffmpeg` on PATH (palette PNG and
// GIF encoding) and network access to image.pollinations.ai, which renders the AI image scenario.
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))
const assetsDir = join(root, 'docs', 'assets')
const workDir = await mkdtemp(join(tmpdir(), 'node-wright-readme-assets-'))

/** Playwright screenshots have no pointer, so the GIF draws one that follows the real input. */
const cursorScript = `(() => {
  const cursor = document.createElement('div')
  cursor.setAttribute('aria-hidden', 'true')
  cursor.style.cssText =
    'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(-80px,-80px)'
  cursor.innerHTML =
    '<span style="position:absolute;left:-14px;top:-14px;width:28px;height:28px;border-radius:50%;' +
    'background:rgba(139,147,255,0.3);border:2px solid rgba(139,147,255,0.9);opacity:0;' +
    'transition:opacity 80ms"></span>' +
    '<svg width="20" height="26" viewBox="0 0 20 26" style="position:absolute;left:-1px;top:-1px">' +
    '<path d="M1.5 1.5v19.2l5.1-4.6 3.3 7.6 3.4-1.5-3.3-7.5h6.9z" fill="#fff" stroke="#111" ' +
    'stroke-width="1.6" stroke-linejoin="round"/></svg>'
  const ring = cursor.firstElementChild
  document.body.append(cursor)
  const place = (event) => {
    cursor.style.transform = 'translate(' + event.clientX + 'px,' + event.clientY + 'px)'
  }
  addEventListener('pointermove', place, true)
  addEventListener('pointerdown', (event) => { place(event); ring.style.opacity = '1' }, true)
  addEventListener('pointerup', (event) => { place(event); ring.style.opacity = '0' }, true)
})()`

assertFfmpeg()
await mkdir(assetsDir, { recursive: true })

const server = await createServer({
  root: join(root, 'playground'),
  configFile: join(root, 'playground', 'config', 'vite.config.ts'),
  logLevel: 'warn',
  server: { host: '127.0.0.1', port: 4190, strictPort: true },
})
const browser = await chromium.launch()

try {
  await server.listen()
  const appUrl = server.resolvedUrls.local[0]
  const imageService = createImageService()

  // Each scenario starts fitted into the canvas area the floating panels leave free.
  for (const theme of ['dark', 'light']) {
    await captureScreenshot(browser, appUrl, imageService, {
      theme,
      scenario: 'AI 图片生成',
      viewport: { width: 1440, height: 900 },
      file: `playground-ai-image-${theme}.png`,
    })
    await captureScreenshot(browser, appUrl, imageService, {
      theme,
      scenario: '审批发布流程',
      viewport: { width: 1440, height: 900 },
      file: `playground-execflow-${theme}.png`,
    })
  }

  await captureScreenshot(browser, appUrl, imageService, {
    theme: 'dark',
    scenario: 'AI 图片生成',
    viewport: { width: 390, height: 844 },
    openDrawer: true,
    file: 'playground-phone-dark.png',
  })
  await captureConnectAndRunGif(browser, appUrl, imageService, 'demo-connect-run.gif')
} finally {
  await browser.close()
  await server.close()
  await rm(workDir, { recursive: true, force: true })
}

/**
 * Serves the page's requests to the image service from the real service: every image URL is
 * fetched once and replayed afterwards, and `hold()` keeps answers back while a GIF records the
 * running state.
 */
function createImageService() {
  const responses = new Map()
  let release = Promise.resolve()

  return {
    async install(page) {
      await page.route('https://image.pollinations.ai/**', async (route) => {
        await release
        const url = route.request().url()

        if (!responses.has(url)) {
          responses.set(url, fetchImage(url))
        }

        try {
          await route.fulfill(await responses.get(url))
        } catch (error) {
          // The run then fails visibly and the capture stops with the scenario's error message.
          console.error(`Image service request failed: ${error.message}`)
          await route.abort('failed')
        }
      })
    },
    hold() {
      let open
      release = new Promise((resolve) => {
        open = resolve
      })

      return open
    },
  }
}

async function fetchImage(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) })

  if (!response.ok) {
    throw new Error(`The image service answered HTTP ${response.status} for ${url}`)
  }

  return {
    status: 200,
    headers: {
      'access-control-allow-origin': '*',
      'content-type': response.headers.get('content-type') ?? 'image/jpeg',
    },
    body: Buffer.from(await response.arrayBuffer()),
  }
}

async function openPlayground(browser, appUrl, imageService, viewport, theme) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2, colorScheme: theme })
  const failures = []

  page.on('pageerror', (error) => failures.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      failures.push(message.text())
    }
  })
  await imageService.install(page)
  await page.goto(appUrl)
  await page.locator('.nw-default-dom-node').first().waitFor()

  return { page, failures }
}

async function captureScreenshot(browser, appUrl, imageService, options) {
  const { page, failures } = await openPlayground(
    browser,
    appUrl,
    imageService,
    options.viewport,
    options.theme,
  )

  await page
    .getByRole('navigation', { name: '演示场景' })
    .getByRole('button', { name: options.scenario })
    .click()
  await appButton(page, '运行').click()
  await waitForRunResult(page)

  if (options.openDrawer) {
    await page.getByRole('button', { name: '展开运行面板' }).click()
  }

  // Park the pointer on the empty canvas below the graph, so no control keeps its hover style.
  await page.mouse.move(options.viewport.width / 2, options.viewport.height - 4)
  await finishTransitions(page)
  await settle(page)
  assertNoFailures(failures, options.file)

  const raw = join(workDir, options.file)

  await page.screenshot({ path: raw })
  await writePalettePng(raw, join(assetsDir, options.file))
  await page.close()
}

/**
 * Drags the preview node into place, connects it, runs the graph until the image shows, then
 * navigates the canvas from the minimap.
 */
async function captureConnectAndRunGif(browser, appUrl, imageService, file) {
  const viewport = { width: 1440, height: 760 }
  const { page, failures } = await openPlayground(browser, appUrl, imageService, viewport, 'dark')

  // Starting state: the preview node is disconnected and set aside below its place.
  const generate = domNode(page, '生成图片')
  const preview = domNode(page, '图片预览')
  const source = await center(outputPort(generate))
  const target = await center(inputPort(preview).first())

  await page.mouse.click((source.x + target.x) / 2, (source.y + target.y) / 2, { button: 'right' })
  await page.locator('.runtime-panel__stats').getByText('2 条连线').waitFor()

  const header = await center(preview.locator('.nw-default-dom-node__header'))
  const aside = { x: -40, y: 110 }

  await page.mouse.move(header.x, header.y)
  await page.mouse.down()
  await page.mouse.move(header.x + aside.x, header.y + aside.y, { steps: 4 })
  await page.mouse.up()
  await page.addScriptTag({ content: cursorScript })

  const frames = createFrameRecorder(page, { x: 0, y: 0, ...viewport })
  let pointer = { x: viewport.width * 0.42, y: viewport.height * 0.9 }

  async function glide(to, count) {
    const from = pointer

    for (let index = 1; index <= count; index += 1) {
      const t = easeInOut(index / count)

      await page.mouse.move(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t)
      await frames.capture()
    }

    pointer = to
  }

  async function click(to, count) {
    await glide(to, count)
    await page.mouse.down()
    await frames.hold(1)
    await page.mouse.up()
  }

  await page.mouse.move(pointer.x, pointer.y)
  await frames.hold(10)

  // 1. Drag the preview node back next to the generator.
  const asideHeader = await center(preview.locator('.nw-default-dom-node__header'))

  await glide(asideHeader, 12)
  await page.mouse.down()
  await frames.hold(2)
  await glide({ x: asideHeader.x - aside.x, y: asideHeader.y - aside.y }, 14)
  await page.mouse.up()
  await frames.hold(5)

  // 2. Connect the image URL output to the preview input.
  const imageUrlPort = await center(outputPort(generate))
  const previewInput = await center(inputPort(preview).first())

  await glide(imageUrlPort, 10)
  await page.mouse.down()
  await frames.hold(2)
  await glide({ x: (imageUrlPort.x + previewInput.x) / 2, y: imageUrlPort.y + 46 }, 8)
  await glide(previewInput, 8)
  await page.mouse.up()
  await page.locator('.runtime-panel__stats').getByText('3 条连线').waitFor()
  await frames.hold(6)

  // 3. Run: the image request is held so the running state stays on screen for a moment.
  await glide(await center(appButton(page, '运行')), 14)
  await frames.hold(2)

  const releaseImages = imageService.hold()

  await page.mouse.down()
  await page.mouse.up()
  await appButton(page, '运行中').waitFor()
  await frames.hold(8)
  releaseImages()
  await waitForRunResult(page)
  await frames.hold(20)

  // 4. Zoom in, then pan around the graph by dragging the visible area in the minimap.
  const zoomIn = page.getByRole('group', { name: '缩放' }).getByRole('button', { name: '放大' })

  await click(await center(zoomIn), 14)
  await frames.hold(3)
  await click(await center(zoomIn), 2)
  await frames.hold(8)

  const visibleArea = await center(page.locator('.nw-minimap__viewport'))

  await glide(visibleArea, 14)
  await page.mouse.down()
  await frames.hold(2)
  await glide({ x: visibleArea.x - 46, y: visibleArea.y - 14 }, 12)
  await frames.hold(3)
  await glide({ x: visibleArea.x + 38, y: visibleArea.y + 12 }, 16)
  await page.mouse.up()
  await frames.hold(6)
  await glide({ x: pointer.x - 220, y: pointer.y - 40 }, 10)
  await settle(page)
  await frames.hold(30)
  assertNoFailures(failures, file)

  await writeGif(frames.directory, join(assetsDir, file))
  await page.close()
}

function createFrameRecorder(page, clip) {
  const directory = join(workDir, 'frames')
  let count = 0

  async function write(buffer) {
    count += 1
    await writeFile(join(directory, `frame-${String(count).padStart(4, '0')}.png`), buffer)
  }

  return {
    directory,
    async capture() {
      await mkdir(directory, { recursive: true })
      await settle(page)
      await write(await page.screenshot({ clip }))
    },
    /** Repeats the current screen; the GIF encoder stores repeated frames as empty updates. */
    async hold(frameCount) {
      await mkdir(directory, { recursive: true })
      await settle(page)
      const buffer = await page.screenshot({ clip })

      for (let index = 0; index < frameCount; index += 1) {
        await write(buffer)
      }
    },
  }
}

async function waitForRunResult(page) {
  const status = page
    .locator('.runtime-panel__section-header')
    .filter({ hasText: '运行时' })
    .locator('strong')

  const error = page.locator('.runtime-panel__message--error')

  // A finished run sets the status; a run that throws leaves it idle and shows an error message.
  // On phones the run panel is a collapsed drawer, so the status only needs to be in the page.
  await status
    .filter({ hasText: /^(成功|错误|已取消)$/u })
    .or(error)
    .first()
    .waitFor({ state: 'attached', timeout: 150_000 })

  if ((await status.textContent())?.trim() !== '成功') {
    const message = (await error.count()) ? await error.textContent() : await status.textContent()

    throw new Error(`The scenario run did not succeed: ${message?.trim()}`)
  }

  await page.waitForFunction(
    `[...document.querySelectorAll('.ai-image-display img')].every(
      (image) => image.complete && image.naturalWidth > 0,
    )`,
    undefined,
    { timeout: 150_000 },
  )
}

/** Waits for web fonts and two animation frames, so canvas layers have painted. */
async function settle(page) {
  await page.evaluate(
    `document.fonts.ready.then(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    )`,
  )
}

/** Waits for finite CSS transitions and animations, such as the drawer toggle icon turning. */
async function finishTransitions(page) {
  await page.evaluate(
    `Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    )`,
  )
}

function appButton(page, name) {
  return page.getByRole('toolbar', { name: '画布操作' }).getByRole('button', { name, exact: true })
}

function domNode(page, title) {
  return page.locator('.nw-default-dom-node', {
    has: page.locator('.nw-default-dom-node__title', { hasText: title }),
  })
}

function outputPort(node) {
  return node.locator('.nw-default-dom-node__port--right .nw-default-dom-node__port-dot')
}

function inputPort(node) {
  return node.locator('.nw-default-dom-node__port--left .nw-default-dom-node__port-dot')
}

async function box(locator) {
  const bounds = await locator.boundingBox()

  if (!bounds) {
    throw new Error('Element is not rendered.')
  }

  return bounds
}

async function center(locator) {
  const bounds = await box(locator)

  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

function assertNoFailures(failures, file) {
  if (failures.length) {
    throw new Error(
      `The playground reported errors while capturing ${file}:\n${failures.join('\n')}`,
    )
  }
}

function assertFfmpeg() {
  const result = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' })

  if (result.error || result.status !== 0) {
    throw new Error('ffmpeg is required on PATH to encode the README images.')
  }
}

function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { encoding: 'utf8' })

  if (result.status !== 0) {
    throw new Error(`ffmpeg failed: ${result.stderr}`)
  }
}

/** 256-color palette PNG: the UI is mostly flat colors, so it stays sharp at a fraction of the size. */
async function writePalettePng(input, output) {
  ffmpeg([
    '-i',
    input,
    '-vf',
    'split[a][b];[a]palettegen=max_colors=256:reserve_transparent=0[p];[b][p]paletteuse=dither=sierra2_4a',
    '-frames:v',
    '1',
    '-update',
    '1',
    '-compression_level',
    '9',
    output,
  ])
  await report(output)
}

/** 12.5 fps GIF at 900 px wide with one shared palette and per-frame dirty rectangles. */
async function writeGif(framesDirectory, output) {
  ffmpeg([
    '-framerate',
    '12.5',
    '-i',
    join(framesDirectory, 'frame-%04d.png'),
    '-vf',
    'scale=900:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=256:stats_mode=full:reserve_transparent=0[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle',
    '-loop',
    '0',
    output,
  ])
  await report(output)
}

async function report(file) {
  const { size } = await stat(file)

  console.log(`${file.slice(root.length)}  ${(size / 1024).toFixed(0)} KB`)
}
