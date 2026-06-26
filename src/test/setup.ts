import '@testing-library/jest-dom'

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

Object.defineProperty(URL, 'createObjectURL', {
  writable: true,
  value: vi.fn(() => 'blob:mock-image-url'),
})

Object.defineProperty(URL, 'revokeObjectURL', {
  writable: true,
  value: vi.fn(),
})

Object.defineProperty(window.HTMLCanvasElement.prototype, 'getContext', {
  writable: true,
  value: vi.fn(() => ({
    drawImage: vi.fn(),
  })),
})

Object.defineProperty(window.HTMLCanvasElement.prototype, 'toBlob', {
  writable: true,
  value: vi.fn((
    callback: BlobCallback,
    type?: string,
  ) => {
    callback(new Blob(['processed-image'], { type: type ?? 'image/jpeg' }))
  }),
})

Object.defineProperty(window, 'Image', {
  writable: true,
  value: class ImageMock {
    width = 640
    height = 480
    onload: ((event: Event) => void) | null = null
    onerror: ((event: Event) => void) | null = null

    set src(_value: string) {
      queueMicrotask(() => {
        this.onload?.(new Event('load'))
      })
    }
  },
})

window.scrollTo = vi.fn()
