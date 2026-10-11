import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import asar from '@electron/asar'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { Readable } from 'node:stream'
import { finished } from 'node:stream/promises'

// Reuse a verified Electron distribution and its ABI-matched native binaries
// when the machine cannot rebuild them.
const defaultSource = fs.existsSync('dist/win-unpacked/resources/app.asar')
  ? 'dist/win-unpacked'
  : 'dist/performance-preview/win-unpacked'
const source = path.resolve(process.argv[2] || defaultSource)
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
    const relative = file.replace(/^[\\/]/, '')
    return (
      !entry.files &&
      (entry.unpacked || fs.existsSync(path.join(`${originalArchive}.unpacked`, relative)))
    )
  })
  .map((file) => file.replace(/^[\\/]/, '').replace(/\\/g, '/'))
const hash = (data) => createHash('sha256').update(data).digest('hex')
const nativePath = (file) => file.replace(/\//g, path.sep)
const originalHashes = new Map(
  unpacked.map((file) => [file, hash(asar.extractFile(originalArchive, nativePath(file)))])
)
if (!originalHashes.size) { throw new Error('The source distribution has no reusable native resources.') }
const staging = fs.mkdtempSync(path.join(dist, 'runtime-reuse-'))
try {
  // Read unchanged dependencies directly from the archive. Extracting and
  // rescanning thousands of files needlessly stalls Windows virus scanners.
  const original = fs.readFileSync(originalArchive)
  const { header, headerSize } = asar.getRawHeader(originalArchive)
  const streams = []
  const fileStream = (filename, buffer, unpacked = false, mode = 0o644) => ({
    path: filename,
    type: 'file',
    unpacked,
    stat: { size: buffer.length, mode },
    streamGenerator: () => Readable.from([buffer])
  })
  const appendOriginal = (files, prefix = '') => {
    for (const [name, entry] of Object.entries(files)) {
      const filename = prefix ? `${prefix}/${name}` : name
      if (filename === 'out') continue
      if (entry.files) {
        streams.push({ path: filename, type: 'directory', unpacked: !!entry.unpacked })
        appendOriginal(entry.files, filename)
      } else if (entry.link) {
        streams.push({
          path: filename,
          type: 'link',
          unpacked: !!entry.unpacked,
          stat: { mode: 0o644 },
          symlink: path.relative(path.dirname(filename), entry.link)
        })
      } else {
        const offset = 8 + headerSize + Number(entry.offset || 0)
        const data = entry.unpacked
          ? fs.readFileSync(path.join(`${originalArchive}.unpacked`, nativePath(filename)))
          : original.subarray(offset, offset + entry.size)
        streams.push(
          fileStream(filename, data, originalHashes.has(filename), entry.executable ? 0o755 : 0o644)
        )
      }
    }
  }
  appendOriginal(header.files)
  const appendBuild = (directory, prefix = 'out') => {
    streams.push({ path: prefix, type: 'directory' })
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name)
      const filename = `${prefix}/${entry.name}`
      if (entry.isDirectory()) appendBuild(fullPath, filename)
      else streams.push(fileStream(filename, fs.readFileSync(fullPath)))
    }
  }
  appendBuild(built)
  if (!fs.existsSync(target)) fs.cpSync(source, target, { recursive: true })
  const archive = path.join(staging, 'app.asar')
  const written = await asar.createPackageFromStreams(archive, streams)
  await finished(written)
  for (const [file, originalHash] of originalHashes) {
    if (hash(asar.extractFile(archive, nativePath(file))) !== originalHash) { throw new Error(`Native binary changed: ${file}`) }
  }
  fs.copyFileSync(archive, path.join(target, 'resources/app.asar'))
  fs.cpSync(`${archive}.unpacked`, path.join(target, 'resources/app.asar.unpacked'), {
    recursive: true
  })
  fs.cpSync(path.resolve('packages/desktop/static'), path.join(target, 'resources/static'), {
    recursive: true,
    filter: (file) =>
      !file.endsWith('.json') ||
      !file.includes(`${path.sep}locales${path.sep}`) ||
      file.endsWith('.min.json')
  })
  for (const name of ['icon.ico', 'md.ico']) {
    fs.copyFileSync(
      path.resolve('packages/desktop/build/icons', name),
      path.join(target, 'resources/icons', name)
    )
  }
  const require = createRequire(import.meta.url)
  const rcedit = path.join(
    path.dirname(require.resolve('electron-winstaller/package.json')),
    'vendor/rcedit.exe'
  )
  execFileSync(
    rcedit,
    [
      path.join(target, 'marktext.exe'),
      '--set-icon',
      path.resolve('packages/desktop/static/icon.ico')
    ],
    { windowsHide: true }
  )
  console.log(`Packaged ${target}; verified ${originalHashes.size} reused native files.`)
} finally {
  if (staging.startsWith(dist + path.sep)) fs.rmSync(staging, { recursive: true, force: true })
}
