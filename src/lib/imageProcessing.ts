export class StaleFileError extends Error {
  constructor() {
    super('Please reselect the photo before continuing.')
    this.name = 'StaleFileError'
  }
}

export async function preparePhotoForUpload(
  file: File | Blob | null | undefined,
  options: { signal?: AbortSignal } = {},
): Promise<Blob> {
  if (!file) {
    throw new StaleFileError()
  }

  // Check if it's a valid file object with data
  if (!(file instanceof File) && !(file instanceof Blob)) {
    throw new StaleFileError()
  }
  
  if (file.size === 0) {
    throw new StaleFileError()
  }

  if (!file.type.startsWith('image/')) {
    throw new StaleFileError()
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    let settled = false

    const cleanup = () => {
      URL.revokeObjectURL(url)
      options.signal?.removeEventListener('abort', abort)
    }

    const abort = () => {
      if (settled) return
      settled = true
      img.src = ''
      cleanup()
      reject(new DOMException('Photo processing was cancelled.', 'AbortError'))
    }

    if (options.signal?.aborted) {
      abort()
      return
    }

    options.signal?.addEventListener('abort', abort, { once: true })

    img.onload = () => {
      if (settled) return
      URL.revokeObjectURL(url)
      
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        settled = true
        options.signal?.removeEventListener('abort', abort)
        reject(new Error('Could not process image.'))
        return
      }
      
      ctx.drawImage(img, 0, 0)
      
      canvas.toBlob(
        (blob) => {
          if (settled) return
          settled = true
          options.signal?.removeEventListener('abort', abort)
          if (!blob) {
            reject(new Error('Failed to encode image.'))
            return
          }
          resolve(blob)
        },
        'image/jpeg',
        0.88
      )
    }

    img.onerror = () => {
      if (settled) return
      settled = true
      cleanup()
      reject(new StaleFileError())
    }
    
    img.src = url
  })
}
