export const rendererUrl = 'http://127.0.0.1:5174'

export function browserWindowSecurity() {
  return {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  } as const
}
