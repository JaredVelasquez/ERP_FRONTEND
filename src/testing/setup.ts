import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: TestResizeObserver })
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, value: () => null })
Object.defineProperty(window, 'scrollTo', { configurable: true, value: () => undefined })

afterEach(() => {
  cleanup()
})
