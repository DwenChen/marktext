import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { appendFile, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

async function main () {
  const runId = process.env.BUILD_RUN_ID
  const tag = process.env.RELEASE_TAG
  const repo = process.env.GITHUB_REPOSITORY
  const token = process.env.GH_TOKEN
  if (!/^\d+$/.test(runId || '') || !/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag || '') || !/^[\w.-]+\/[\w.-]+$/.test(repo || '') || !token) {
    throw new Error('Set BUILD_RUN_ID, RELEASE_TAG, GITHUB_REPOSITORY, and GH_TOKEN')
  }
  const version = tag.slice(1)
  const directory = path.resolve(process.env.RELEASE_DIST_DIR || 'dist')
  const info = JSON.parse((await readFile(path.join(directory, 'build-info.json'), 'utf8')).replace(/^\uFEFF/, ''))
  const runUrl = `https://github.com/${repo}/actions/runs/${runId}`
  if (info.version !== version || info.platform !== 'win32-x64' || info.run !== runUrl || !/^[a-f0-9]{40}$/.test(info.commit || '')) {
    throw new Error('Build provenance does not match the requested release')
  }
  async function api (endpoint, allowMissing = false) {
    const response = await fetch(`https://api.github.com/repos/${repo}/${endpoint}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(60000)
    })
    if (allowMissing && response.status === 404) return null
    if (!response.ok) throw new Error(`GitHub API returned ${response.status}`)
    return response.json()
  }
  const run = await api(`actions/runs/${runId}`)
  if (run.status !== 'completed' || run.conclusion !== 'success' || run.head_sha !== info.commit || run.path !== '.github/workflows/windows-preview.yml') {
    throw new Error('The source Windows build must have succeeded at the recorded commit')
  }
  const ref = await api(`git/ref/tags/${tag}`, true)
  let target = ref?.object
  for (let i = 0; target?.type === 'tag' && i < 5; i++) target = (await api(`git/tags/${target.sha}`)).object
  if (target && (target.type !== 'commit' || target.sha !== info.commit)) throw new Error('The existing release tag points at a different commit')

  const names = [`marktext-win-x64-${version}-setup.exe`, `marktext-win-x64-${version}.zip`]
  const lines = (await readFile(path.join(directory, 'SHA256SUMS.txt'), 'utf8')).replace(/^\uFEFF/, '').trim().split(/\r?\n/)
  const checksums = new Map()
  for (const line of lines) {
    const match = /^([a-f0-9]{64}) {2}([^\\/]+)$/.exec(line)
    if (!match || !names.includes(match[2]) || checksums.has(match[2])) throw new Error('Unexpected checksum entry')
    checksums.set(match[2], match[1])
  }
  if (checksums.size !== names.length) throw new Error('Both Windows downloads must have checksums')
  const assets = []
  for (const name of [...names, 'SHA256SUMS.txt', 'build-info.json']) {
    const file = path.join(directory, name)
    const hash = createHash('sha256')
    for await (const chunk of createReadStream(file)) hash.update(chunk)
    const sha256 = hash.digest('hex')
    if (checksums.has(name) && checksums.get(name) !== sha256) throw new Error(`Checksum mismatch: ${name}`)
    assets.push({ name, bytes: (await stat(file)).size, sha256 })
  }
  const notes = await readFile(`docs/releases/${tag}.md`, 'utf8')
  await writeFile(path.join(directory, 'release-notes.md'), `${notes.trim()}\n\n构建来源：[${info.commit.slice(0, 8)}](https://github.com/${repo}/commit/${info.commit}) · [云端构建](${runUrl})\n`)
  await writeFile(path.join(directory, 'release-assets.json'), JSON.stringify(assets, null, 2) + '\n')
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `commit=${info.commit}\nversion=${version}\n`)
  console.log(JSON.stringify({ verified: true, tag, commit: info.commit, assets }))
}

await main()
