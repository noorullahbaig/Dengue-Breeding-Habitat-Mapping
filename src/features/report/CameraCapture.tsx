import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { captureFrameAsFile, readFileAsDataUrl, requestCameraStream, stopCameraStream } from '@/lib/camera'
import { InlineNotice } from '@/components/InlineNotice'

interface CameraCaptureProps {
  previewUrl?: string
  photoName?: string
  onFileReady: (file: File, previewUrl: string) => void
}

export function CameraCapture({
  previewUrl,
  photoName,
  onFileReady,
}: CameraCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const video = videoRef.current

    if (!video) {
      return
    }

    if (stream) {
      video.srcObject = stream
      void video.play().catch(() => {
        setError('The live preview could not start. Use the upload fallback instead.')
      })
      return
    }

    video.srcObject = null
  }, [stream])

  useEffect(() => {
    return () => {
      stopCameraStream(stream)
    }
  }, [stream])

  async function handleLiveCamera() {
    setIsBusy(true)
    setError('')

    try {
      const nextStream = await requestCameraStream()
      stopCameraStream(stream)
      setStream(nextStream)
    } catch (cameraError) {
      setError(
        cameraError instanceof Error ? cameraError.message : 'Camera access failed.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  async function handleCaptureFrame() {
    if (!videoRef.current) {
      return
    }

    setIsBusy(true)
    setError('')

    try {
      const file = await captureFrameAsFile(videoRef.current)
      const nextPreview = await readFileAsDataUrl(file)
      onFileReady(file, nextPreview)
    } catch (captureError) {
      setError(
        captureError instanceof Error
          ? captureError.message
          : 'The frame could not be captured.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setIsBusy(true)
    setError('')

    try {
      const nextPreview = await readFileAsDataUrl(file)
      onFileReady(file, nextPreview)
    } catch (fileError) {
      setError(
        fileError instanceof Error
          ? fileError.message
          : 'The selected image could not be processed.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <section className="panel">
      <div className="stack-md">
        <div className="cluster-row">
          <button
            type="button"
            className="button button--secondary"
            onClick={handleLiveCamera}
            disabled={isBusy}
          >
            Enable live camera
          </button>
          {stream ? (
            <>
              <button
                type="button"
                className="button"
                onClick={handleCaptureFrame}
                disabled={isBusy}
              >
                Capture frame
              </button>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => {
                  stopCameraStream(stream)
                  setStream(null)
                }}
              >
                Stop camera
              </button>
            </>
          ) : null}
        </div>

        {error ? <InlineNotice tone="warning">{error}</InlineNotice> : null}

        <div className="camera-preview">
          {stream ? (
            <video
              ref={videoRef}
              className="camera-preview__media"
              autoPlay
              muted
              playsInline
            />
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt="Selected report evidence"
              className="camera-preview__media"
            />
          ) : (
            <div className="camera-preview__placeholder">
              <p>Capture one clear photo of the suspected habitat.</p>
              <p>Focus on the container or drain opening, not people or house numbers.</p>
            </div>
          )}
        </div>

        <label className="upload-tile">
          <span className="upload-tile__eyebrow">Browser fallback</span>
          <strong>Upload a photo from this device</strong>
          <span className="caption-text">
            Use this if camera access is blocked or the evidence image is already saved on the laptop.
          </span>
          <span className="upload-tile__action">Choose image</span>
          <input
            className="upload-tile__input"
            type="file"
            accept="image/*"
            capture="environment"
            aria-label="Upload a photo instead"
            onChange={handleFileSelection}
          />
        </label>

        {photoName ? <p className="caption-text">Current evidence: {photoName}</p> : null}
      </div>
    </section>
  )
}
