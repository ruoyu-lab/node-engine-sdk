import { mkdir, readdir, readFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const packagesDir = join(root, 'packages')
const outputDir = join(root, 'packed')
const cacheDir = join(root, '.npm-pack-cache')

const packages = await readWorkspacePackages()

await rm(outputDir, { recursive: true, force: true })
await mkdir(outputDir, { recursive: true })
await mkdir(cacheDir, { recursive: true })

for (const pkg of packages) {
  run('npm', ['pack', '--pack-destination', outputDir, '--cache', cacheDir], {
    cwd: pkg.directory,
  })
}

console.log(`Packed ${packages.length} package(s) into ${relative(outputDir)}`)

async function readWorkspacePackages() {
  const entries = await readdir(packagesDir, { withFileTypes: true })
  const result = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const directory = join(packagesDir, entry.name)
    const manifestPath = join(directory, 'package.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))

    if (manifest.private === true) {
      continue
    }

    result.push({
      name: manifest.name,
      directory,
    })
  }

  return result.sort((left, right) => left.name.localeCompare(right.name))
}

function run(command, args, options) {
  const result = spawnSync(command, args, {
    ...options,
    stdio: 'inherit',
    shell: false,
  })

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed`)
  }
}

function relative(path) {
  return resolve(path).replace(`${root}/`, '')
}
