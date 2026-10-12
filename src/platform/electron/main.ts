import { app, BrowserWindow } from 'electron'
import { fileURLToPath } from 'node:url'
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

app.whenReady().then(() => {
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
