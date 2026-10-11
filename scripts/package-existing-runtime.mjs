import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import asar from '@electron/asar'

// Reuse a verified Electron distribution and its ABI-matched native binaries
// when the machine cannot rebuild them.
const source = path.resolve(process.argv[2] || 'dist/performance-preview/win-unpacked')
const target = path.resolve(process.argv[3] || 'dist/optimization-preview/win-unpacked')
const dist = path.resolve('dist')
const update = process.argv.includes('--update')
if (
  !target.startsWith(dist + path.sep) ||
  target === source ||
  (fs.existsSync(target) && !update)
) {
  throw new Error('Choose a new output directory inside dist.')
}
const originalArchive = path.join(source, 'resources/app.asar')
const built = path.resolve('packages/desktop/out')
if (!fs.existsSync(originalArchive) || !fs.existsSync(path.join(built, 'main/index.js'))) {
  throw new Error(
    'An existing packaged application and a completed electron-vite build are required.'
  )
}
const unpacked = asar
  .listPackage(originalArchive)
  .filter((file) => {
    const entry = asar.statFile(originalArchive, file.replace(/^[\\/]/, ''))
    return entry.unpacked && !entry.files
  })
  .map((file) => file.replace(/^[\\/]/, '').replace(/\\/g, '/'))
const hash = (data) => createHash('sha256').update(data).digest('hex')
const nativePath = (file) => file.replace(/\//g, path.sep)
const originalHashes = new Map(
  unpacked.map((file) => [file, hash(asar.extractFile(originalArchive, nativePath(file)))])
)
const staging = fs.mkdtempSync(path.join(dist, 'runtime-reuse-'))
try {
  asar.extractAll(originalArchive, staging)
  const previousBuild = path.resolve(staging, 'out')
  if (!previousBuild.startsWith(staging + path.sep)) throw new Error('Invalid staging path.')
  fs.rmSync(previousBuild, { recursive: true, force: true })
  fs.cpSync(built, previousBuild, { recursive: true })
  if (!fs.existsSync(target)) fs.cpSync(source, target, { recursive: true })
  const archive = path.join(target, 'resources/app.asar')
  await asar.createPackageWithOptions(staging, archive, {
    unpack: `{${unpacked.join(',')}}`
  })
  const locales = path.resolve('packages/desktop/static/locales')
  for (const locale of fs.readdirSync(locales).filter((file) => file.endsWith('.min.json'))) {
    fs.copyFileSync(
      path.join(locales, locale),
      path.join(target, 'resources/static/locales', locale)
    )
  }
  for (const [file, originalHash] of originalHashes) {
    if (hash(asar.extractFile(archive, nativePath(file))) !== originalHash) {
      throw new Error(`Native binary changed: ${file}`)
    }
  }
  console.log(`Packaged ${target}; verified ${originalHashes.size} reused native files.`)
} finally {
  if (staging.startsWith(dist + path.sep)) fs.rmSync(staging, { recursive: true, force: true })
}
