import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readFile, rename, rmdir, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

async function main () {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const repo = 'DwenChen/marktext'
  const [operation, commit] = process.argv.slice(2)
  if (!['status', 'download'].includes(operation) || !/^[a-f0-9]{40}$/.test(commit || '')) { throw new Error('Usage: node scripts/download-windows-build.mjs status|download <full commit SHA>') }

  const credential = spawnSync('git', ['credential', 'fill'], {
    cwd: root,
    input: `url=https://github.com/${repo}.git\n\n`,
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' }
  })
  const token = process.env.GITHUB_TOKEN || credential.stdout?.match(/^password=(.+)$/m)?.[1]
  if (!token) throw new Error('No GitHub credential available; sign in with Git Credential Manager or set GITHUB_TOKEN')
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  async function api (endpoint) {
    const result = await fetch(`https://api.github.com/repos/${repo}/${endpoint}`, { headers, signal: AbortSignal.timeout(60000) })
    if (!result.ok) throw new Error(`GitHub API returned ${result.status}`)
    return result.json()
  }
  const { workflow_runs: runs } = await api(`actions/workflows/windows-preview.yml/runs?head_sha=${commit}&per_page=10`)
  const run = runs.find(item => item.head_sha === commit)
  if (!run) {
    console.log(JSON.stringify({ commit, status: 'not_started' }))
    return
  }
  console.log(JSON.stringify({ commit, run: run.id, url: run.html_url, status: run.status, conclusion: run.conclusion }))
  if (operation === 'status') {
    const { jobs } = await api(`actions/runs/${run.id}/jobs`)
    console.log(JSON.stringify(jobs.map(job => ({ id: job.id, status: job.status, conclusion: job.conclusion, steps: job.steps.map(step => ({ name: step.name, status: step.status, conclusion: step.conclusion })) }))))
    return
  }
  if (run.status !== 'completed' || run.conclusion !== 'success') { throw new Error('The build must succeed before downloading its deliverables') }
  const { artifacts } = await api(`actions/runs/${run.id}/artifacts`)
  const artifact = artifacts.find(item => item.name === 'marktext-windows-x64' && !item.expired)
  if (!artifact) throw new Error('Windows build artifact is missing or expired')
  const staging = path.join(root, 'dist', `.download-${run.id}`)
  await mkdir(staging, { recursive: true })
  const archive = path.join(staging, 'artifact.zip')
  const response = await fetch(`https://api.github.com/repos/${repo}/actions/artifacts/${artifact.id}/zip`, { headers, signal: AbortSignal.timeout(600000) })
  if (!response.ok || !response.body) throw new Error(`Artifact download returned ${response.status}`)
  await pipeline(Readable.fromWeb(response.body), createWriteStream(archive))
  const extract = spawnSync('powershell.exe', ['-NoProfile', '-Command', `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskArchive = [IO.Compression.ZipFile]::OpenRead($env:MARKTEXT_ARTIFACT_ARCHIVE)
try {
  foreach ($entry in $taskArchive.Entries) {
    if ($entry.FullName -ne $entry.Name -or $entry.Name -notmatch '^(?:[^\\/]+\\.(?:exe|zip)|build-info\\.json|SHA256SUMS\\.txt)$') { throw 'Unexpected artifact entry' }
    [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, (Join-Path $env:MARKTEXT_ARTIFACT_STAGING $entry.Name), $true)
  }
} finally { $taskArchive.Dispose() }
`], { encoding: 'utf8', env: { ...process.env, MARKTEXT_ARTIFACT_ARCHIVE: archive, MARKTEXT_ARTIFACT_STAGING: staging }, windowsHide: true })
  if (extract.status !== 0) throw new Error(`Artifact extraction failed: ${extract.stderr}`)
  const info = JSON.parse((await readFile(path.join(staging, 'build-info.json'), 'utf8')).replace(/^\uFEFF/, ''))
  if (info.commit !== commit || info.platform !== 'win32-x64') throw new Error('Artifact provenance does not match this commit and platform')
  const sums = (await readFile(path.join(staging, 'SHA256SUMS.txt'), 'utf8')).replace(/^\uFEFF/, '').trim().split(/\r?\n/)
  const files = []
  for (const line of sums) {
    const match = /^([a-f0-9]{64}) {2}([^\\/]+\.(?:exe|zip))$/.exec(line)
    if (!match) throw new Error('Invalid checksum entry')
    const file = path.join(staging, match[2])
    const hash = createHash('sha256')
    for await (const chunk of createReadStream(file)) hash.update(chunk)
    if (hash.digest('hex') !== match[1]) throw new Error(`Checksum mismatch: ${match[2]}`)
    files.push({ name: match[2], bytes: (await stat(file)).size, sha256: match[1] })
  }
  if (!files.some(file => file.name.endsWith('.exe')) || !files.some(file => file.name.endsWith('.zip'))) { throw new Error('Both installer and portable ZIP must be present') }
  for (const file of [...files.map(item => item.name), 'build-info.json', 'SHA256SUMS.txt']) { await rename(path.join(staging, file), path.join(root, 'dist', file)) }
  console.log(JSON.stringify({ verified: true, directory: path.join(root, 'dist'), files }))
  await unlink(archive)
  await rmdir(staging)
}

await main()
