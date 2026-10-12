import { describe, expect, it } from 'vitest'
import { browserWindowSecurity, rendererUrl } from './window-options'

describe('electron window', () => {
  it('isolates the same storefront and does not enable node in the page', () => {
    expect(browserWindowSecurity()).toEqual({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    })
    expect(rendererUrl).toBe('http://127.0.0.1:5174')
  })
})
