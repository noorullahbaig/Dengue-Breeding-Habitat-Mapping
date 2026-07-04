export async function requestCameraStream() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      'Live camera preview is not available in this browser.',
    )
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotAllowedError') {
      throw new DOMException(
        'Camera access is blocked. Please enable Camera in your browser settings to continue.',
        'NotAllowedError',
      )
    }
    throw new Error(
      'Camera access failed. Please check your browser settings and try again.',
    )
  }
}

export function stopCameraStream(stream: MediaStream | null) {
  for (const track of stream?.getTracks() ?? []) {
    track.stop()
  }
}

export async function readFileAsDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () =>
      reject(new Error('The selected image could not be read.'))
    reader.readAsDataURL(file)
  })
}

export async function captureFrameAsFile(video: HTMLVideoElement) {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error('The camera is still warming up. Try again in a moment.')
  }

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Your browser could not capture a frame from the camera.')
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.92)
  })

  if (!blob) {
    throw new Error('The captured frame could not be processed.')
  }

  return new File([blob], `habitat-report-${Date.now()}.jpg`, {
    type: 'image/jpeg',
  })
}
