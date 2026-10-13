import { defineConfig, devices, type PlaywrightTestOptions } from '@playwright/test'

/** Both playground apps render the same scenario and markup, so every spec runs against each. */
const apps = [
  { name: 'vue', script: 'dev', port: 4173 },
  { name: 'react', script: 'dev:react', port: 4174 },
] as const

/** `layout` tells specs whether the device runs the desktop pointer gestures. */
const targets: Array<{
  name: string
  layout: 'desktop' | 'compact' | 'mobile'
  use: Partial<PlaywrightTestOptions>
}> = [
  {
    name: 'desktop-chromium',
    layout: 'desktop',
    use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
  },
  {
    name: 'compact-chromium',
    layout: 'compact',
    use: { ...devices['Desktop Chrome'], viewport: { width: 800, height: 900 } },
  },
  {
    name: 'mobile-chromium',
    layout: 'mobile',
    use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
  },
  {
    name: 'desktop-firefox',
    layout: 'desktop',
    use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } },
  },
  {
    name: 'desktop-webkit',
    layout: 'desktop',
    use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } },
  },
]

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: apps.flatMap((app) =>
    targets.map((target) => ({
      name: `${app.name}-${target.name}`,
      metadata: { app: app.name, layout: target.layout },
      use: { ...target.use, baseURL: `http://127.0.0.1:${app.port}` },
    })),
  ),
  webServer: apps.map((app) => ({
    command: `npm run ${app.script} -- --host 127.0.0.1 --port ${app.port} --strictPort`,
    url: `http://127.0.0.1:${app.port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  })),
})
