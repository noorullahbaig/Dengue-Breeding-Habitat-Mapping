export class StaleFileError extends Error {
  constructor() {
    super('Please reselect the photo before continuing.')
    this.name = 'StaleFileError'
  }
}

export async function preparePhotoForUpload(file: File | Blob | null | undefined): Promise<Blob> {
  console.log('Validating photo upload:', {
    name: file instanceof File ? file.name : undefined,
    type: file?.type,
    size: file?.size,
    isFile: file instanceof File,
  })

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
    
    img.onload = () => {
      URL.revokeObjectURL(url)
      
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not process image.'))
        return
      }
      
      ctx.drawImage(img, 0, 0)
      
      canvas.toBlob(
        (blob) => {
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
      URL.revokeObjectURL(url)
      reject(new StaleFileError())
    }
    
    img.src = url
  })
}
