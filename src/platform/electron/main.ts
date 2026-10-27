import { app, BrowserWindow, ipcMain, safeStorage } from 'electron'
import { readFile, writeFile, unlink } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { browserWindowSecurity, rendererUrl } from './window-options.js'

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1100,
    height: 800,
    webPreferences: {
      ...browserWindowSecurity(),
      preload: fileURLToPath(new URL('./preload.js', import.meta.url)),
    },
  })
  void window.loadURL(process.env.ELECTRON_RENDERER_URL ?? rendererUrl)
}

function registerSecureSession(): void {
  const file = join(app.getPath('userData'), 'erp-refresh-token.bin')
  ipcMain.handle('erp-session:get-refresh', async (event) => {
    assertTrustedRenderer(event.senderFrame?.url ?? '', event.senderFrame !== null && event.sender.mainFrame === event.senderFrame)
    if (!secureStorageAvailable()) throw new Error('Secure session storage is unavailable')
    const encrypted = await readFile(file).catch(() => null)
    if (encrypted === null) return null
    return safeStorage.decryptString(encrypted)
  })
  ipcMain.handle('erp-session:set-refresh', async (event, token: unknown) => {
    assertTrustedRenderer(event.senderFrame?.url ?? '', event.senderFrame !== null && event.sender.mainFrame === event.senderFrame)
    if (typeof token !== 'string' || token.length < 32 || !secureStorageAvailable()) {
      throw new Error('Secure session storage is unavailable')
    }
    const encrypted = safeStorage.encryptString(token)
    await writeFile(file, encrypted, { mode: 0o600 })
  })
  ipcMain.handle('erp-session:clear-refresh', async (event) => {
    assertTrustedRenderer(event.senderFrame?.url ?? '', event.senderFrame !== null && event.sender.mainFrame === event.senderFrame)
    await unlink(file).catch(() => undefined)
  })
}

function secureStorageAvailable(): boolean {
  if (!safeStorage.isEncryptionAvailable()) return false
  if (process.platform !== 'linux') return true
  return safeStorage.getSelectedStorageBackend() !== 'basic_text'
}

function assertTrustedRenderer(url: string, isMainFrame: boolean): void {
  const trusted = url.startsWith('file:') || url.startsWith('http://127.0.0.1:5174/');
  if (!isMainFrame || !trusted) throw new Error('Untrusted renderer');
}

app.whenReady().then(() => {
  registerSecureSession()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
