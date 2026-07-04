import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui'
import { queryPermissionState, watchPermissionState, type PermissionQueryState } from '@/lib/permissions'
import { requestCameraStream } from '@/lib/camera'
import { PermissionBlocker } from './PermissionBlocker'

interface CameraPermissionGateProps {
  /** Rendered when the camera is accessible and the stream is ready or being requested */
  children: (props: { stream: MediaStream | null; onOpenCamera: () => Promise<void>; cameraError: string }) => React.ReactNode
}

/**
 * Gates camera access for the photo step.
 *
 * Three states:
 *  - querying:  Silently checking permission — shows a loading placeholder
 *  - priming:   Permission not yet asked ('prompt') or unsupported API — shows a
 *               friendly explanation before triggering the real browser prompt
 *  - blocked:   Permission permanently denied — shows PermissionBlocker with
 *               browser-specific settings instructions
 *  - ready:     Permission granted — renders `children` with camera controls
 */
export function CameraPermissionGate({ children }: CameraPermissionGateProps) {
  const [phase, setPhase] = useState<'querying' | 'priming' | 'blocked' | 'ready'>('querying')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState('')

  // Stable ref so the watcher cleanup always points to the same function
  const checkRef = useRef<(() => Promise<void>) | null>(null)

  async function checkAndTransition() {
    const state = await queryPermissionState('camera')

    if (state === 'granted') {
      setPhase('ready')
      return
    }
    if (state === 'denied') {
      setPhase('blocked')
      return
    }
    // 'prompt' or 'unsupported' — show priming UI
    setPhase('priming')
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: checkRef is stable
  useEffect(() => {
    checkRef.current = checkAndTransition

    // Initial check
    void checkAndTransition()

    // Watch for state changes (e.g. user grants from browser bar while on page)
    const cleanup = watchPermissionState('camera', (newState: PermissionQueryState) => {
      if (newState === 'granted') setPhase('ready')
      else if (newState === 'denied') setPhase('blocked')
    })

    return () => {
      cleanup()
      // Stop any open stream on unmount
      setStream((prev) => {
        prev?.getTracks().forEach((track) => {
          track.stop()
        })
        return null
      })
    }
  }, [])

  /**
   * Called when user clicks "Open Camera" from the priming panel, or when the
   * parent requests a camera open. Attempts getUserMedia and transitions state.
   *
   * This is also the fallback path for Firefox which can't pre-query camera state.
   */
  async function handleOpenCamera() {
    setCameraError('')
    try {
      const nextStream = await requestCameraStream()
      // Stop any previous stream before replacing
      setStream((prev) => {
        prev?.getTracks().forEach((track) => {
          track.stop()
        })
        return nextStream
      })
      setPhase('ready')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Camera access failed.'
      // If it was a NotAllowedError, transition to blocked
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setPhase('blocked')
        return
      }
      setCameraError(msg)
      setPhase('ready') // Let children handle other errors (no hardware etc.)
    }
  }

  async function handleRetry() {
    setCameraError('')
    await checkAndTransition()
  }

  if (phase === 'querying') {
    return (
      <div className="permission-gate-skeleton">
        <div className="permission-gate-skeleton__bar" />
        <div className="permission-gate-skeleton__bar permission-gate-skeleton__bar--short" />
      </div>
    )
  }

  if (phase === 'blocked') {
    return <PermissionBlocker permission="camera" onRetry={handleRetry} />
  }

  if (phase === 'priming') {
    return (
      <div className="permission-priming">
        <div className="permission-priming__icon-wrap">
          <svg
            aria-hidden="true"
            className="permission-priming__icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </div>
        <h2 className="permission-priming__heading">Live photo required</h2>
        <p className="permission-priming__body">
          A camera photo is needed to document the breeding habitat and support the public report
          the report on-site. The photo is analysed by our AI model and is not used for
          any other purpose.
        </p>
        <div className="permission-priming__requirement">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Camera-only — no gallery uploads permitted
        </div>
        {cameraError && (
          <p className="permission-priming__error">{cameraError}</p>
        )}
        <Button variant="primary" className="permission-priming__cta" onClick={handleOpenCamera}>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            width="17"
            height="17"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          Open Camera
        </Button>
      </div>
    )
  }

  // phase === 'ready'
  return <>{children({ stream, onOpenCamera: handleOpenCamera, cameraError })}</>
}
