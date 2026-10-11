import path from 'path'
import type { Stats } from 'fs'
import chokidar from 'chokidar'
import type { BrowserWindow } from 'electron'
import { checkPathExcludePattern, hasMarkdownExtension } from 'common/filesystem/paths'
import type { DirectoryEntry, ProjectTreeEvent, ProjectTreeUpdate } from '@shared/types/files'

export const DIRECTORY_EVENT_BATCH_DELAY = 40

export function watchDirectory(
  win: BrowserWindow,
  pathname: string,
  rootPath: string,
  excludePatterns: readonly string[],
  usePolling: boolean,
  onUnlinkDirectory: (pathname: string) => void
) {
  const watcher = chokidar.watch(pathname, {
    depth: 0,
    alwaysStat: true,
    ignoreInitial: false,
    ignorePermissionErrors: true,
    usePolling,
    ignored: (candidate, stats) => {
      if (candidate === pathname) return false
      if (/(?:^|[/\\])(?:node_modules|.+\.asar)(?:[/\\]|$)/.test(candidate)) return true
      if (checkPathExcludePattern(candidate, excludePatterns)) return true
      return !!stats && !stats.isDirectory() && !hasMarkdownExtension(candidate)
    }
  })

  let disposed = false
  let initialized = false
  let timer: NodeJS.Timeout | null = null
  const entries = new Map<string, DirectoryEntry>()
  let events: ProjectTreeEvent[] = []
  let resolveReady: (loaded: boolean) => void = () => {}
  const ready = new Promise<boolean>((resolve) => { resolveReady = resolve })

  const send = (update: ProjectTreeUpdate): void => {
    if (!disposed && !win.isDestroyed()) win.webContents.send('mt::update-object-tree', update)
  }

  const flush = (): void => {
    timer = null
    if (events.length) {
      const batch = events
      events = []
      send({ type: 'batch', rootPath, events: batch })
    }
  }

  const enqueue = (event: ProjectTreeEvent): void => {
    if (disposed) return
    if (!initialized) {
      if (event.type === 'unlink' || event.type === 'unlinkDir') entries.delete(event.change.pathname)
      else if (event.type === 'change') {
        const entry = entries.get(event.change.pathname)
        if (entry) entry.mtimeMs = event.change.mtimeMs as number
      } else entries.set(event.change.pathname, event.change as unknown as DirectoryEntry)
      return
    }
    events.push(event)
    if (!timer) timer = setTimeout(flush, DIRECTORY_EVENT_BATCH_DELAY)
  }

  const addEntry = (candidate: string, stats?: Stats): void => {
    if (disposed || candidate === pathname || !stats) return
    const isDirectory = stats.isDirectory()
    if (!isDirectory && !hasMarkdownExtension(candidate)) return
    enqueue({
      type: isDirectory ? 'addDir' : 'add',
      change: {
        pathname: candidate,
        name: path.basename(candidate),
        isDirectory,
        isFile: !isDirectory,
        isMarkdown: !isDirectory,
        birthTime: stats.birthtimeMs,
        mtimeMs: stats.mtimeMs
      }
    })
  }

  watcher
    .on('add', addEntry)
    .on('addDir', addEntry)
    .on('change', (candidate, stats) => {
      if (stats) enqueue({ type: 'change', change: { pathname: candidate, mtimeMs: stats.mtimeMs } })
    })
    .on('unlink', (candidate) => enqueue({ type: 'unlink', change: { pathname: candidate } }))
    .on('unlinkDir', (candidate) => {
      enqueue({ type: 'unlinkDir', change: { pathname: candidate } })
      if (candidate === rootPath) flush()
      onUnlinkDirectory(candidate)
    })
    .on('ready', () => {
      if (disposed) return
      initialized = true
      send({ type: 'directory', rootPath, pathname, entries: [...entries.values()] })
      entries.clear()
      resolveReady(true)
    })
    .on('error', (error: unknown) => {
      send({ type: 'directory-error', rootPath, pathname, message: String(error) })
      resolveReady(false)
    })

  const close = (): void => {
    disposed = true
    if (timer) clearTimeout(timer)
    events = []
    entries.clear()
    resolveReady(false)
    void watcher.close()
  }

  return { watcher, ready, close }
}
