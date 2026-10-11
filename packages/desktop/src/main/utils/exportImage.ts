import { BrowserWindow, app } from 'electron'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { t } from '../i18n'

export const getImageSize = (width: number, height: number): { width: number; height: number } => {
  width = Math.ceil(width)
  height = Math.ceil(height)
  // Chromium's bitmap limits and peak PNG encoding memory bound a single export.
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 1 ||
    height < 1 ||
    width > 32767 ||
    height > 32767 ||
    width * height > 80_000_000
  ) {
    throw new Error(t('editor.export.imageTooLarge'))
  }
  return { width, height }
}

export const renderLongImage = async(html: string, requestedWidth = 1200): Promise<Buffer> => {
  const width = Math.max(320, Math.min(2400, Math.round(requestedWidth) || 1200))
  const directory = await mkdtemp(path.join(app.getPath('temp'), 'marktext-image-'))
  const win = new BrowserWindow({
    show: false,
    width,
    height: 800,
    useContentSize: true,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      // A hidden native window can stop producing compositor frames on Windows.
      offscreen: true
    }
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event) => event.preventDefault())
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const source = html
      .replace(
        '<head>',
        `<head>
      <meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'">`
      )
      .replace(
        '</head>',
        `<style>
        html, body { margin: 0; min-height: 0; overflow: hidden; background: white; }
        body { padding: 32px; box-sizing: border-box; }
        body article.markdown-body { width: 100%; max-width: none; margin: 0; box-sizing: border-box; }
      </style></head>`
      )
    const filename = path.join(directory, 'document.html')
    await writeFile(filename, source, 'utf8')
    const capture = async(): Promise<Buffer> => {
      await win.loadFile(filename)
      const debuggerClient = win.webContents.debugger
      debuggerClient.attach('1.3')
      await debuggerClient.sendCommand('Emulation.setDeviceMetricsOverride', {
        width,
        height: 800,
        deviceScaleFactor: 1,
        mobile: false
      })
      await debuggerClient.sendCommand('Page.getLayoutMetrics')
      await win.webContents.executeJavaScript(`(async () => {
        await document.fonts.ready;
        await Promise.all(Array.from(document.images, image => image.decode().catch(() => {})));
      })()`)
      const metrics = await debuggerClient.sendCommand('Page.getLayoutMetrics')
      const size = getImageSize(metrics.cssContentSize.width, metrics.cssContentSize.height)
      const { data } = await debuggerClient.sendCommand('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, ...size, scale: 1 }
      })
      return Buffer.from(data, 'base64')
    }
    return await Promise.race([
      capture(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(t('editor.export.imageTimeout'))), 45000)
      })
    ])
  } finally {
    clearTimeout(timeout)
    if (!win.isDestroyed()) win.destroy()
    await rm(directory, { recursive: true, force: true })
  }
}
