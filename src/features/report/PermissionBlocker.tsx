import { useEffect, useState } from 'react'

type BrowserHint = 'chrome' | 'safari' | 'firefox' | 'other'

function detectBrowser(): BrowserHint {
  const ua = navigator.userAgent
  if (ua.includes('Firefox')) return 'firefox'
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'safari'
  if (ua.includes('Chrome') || ua.includes('Chromium') || ua.includes('Edg')) return 'chrome'
  return 'other'
}

interface PermissionBlockerProps {
  permission: 'location' | 'camera'
  onRetry: () => void
}

interface BrowserStep {
  browser: string
  steps: string[]
}

const LOCATION_STEPS: BrowserStep[] = [
  {
    browser: 'Chrome / Edge',
    steps: [
      'Click the 🔒 lock icon in your address bar',
      'Select "Site settings"',
      'Find "Location" and set it to "Allow"',
      'Come back here and tap "Try Again"',
    ],
  },
  {
    browser: 'Safari (iPhone / iPad)',
    steps: [
      'Open the Settings app on your device',
      'Scroll to "Safari" → "Location"',
      'Set to "Allow" or "Ask"',
      'Come back here and tap "Try Again"',
    ],
  },
  {
    browser: 'Safari (Mac)',
    steps: [
      'In Safari menu → Settings → Websites',
      'Click "Location" in the left sidebar',
      'Find this site and set it to "Allow"',
      'Come back here and tap "Try Again"',
    ],
  },
  {
    browser: 'Firefox',
    steps: [
      'Click the 🔒 lock icon in your address bar',
      'Click "Connection secure" → "More information"',
      'Open "Permissions" tab → find "Access Your Location"',
      'Uncheck "Use default" and select "Allow"',
      'Come back here and tap "Try Again"',
    ],
  },
]

const CAMERA_STEPS: BrowserStep[] = [
  {
    browser: 'Chrome / Edge',
    steps: [
      'Click the 🔒 lock icon in your address bar',
      'Select "Site settings"',
      'Find "Camera" and set it to "Allow"',
      'Come back here and tap "Try Again"',
    ],
  },
  {
    browser: 'Safari (iPhone / iPad)',
    steps: [
      'Open the Settings app on your device',
      'Scroll to "Safari" → "Camera"',
      'Set to "Allow" or "Ask"',
      'Come back here and tap "Try Again"',
    ],
  },
  {
    browser: 'Safari (Mac)',
    steps: [
      'In Safari menu → Settings → Websites',
      'Click "Camera" in the left sidebar',
      'Find this site and set it to "Allow"',
      'Come back here and tap "Try Again"',
    ],
  },
  {
    browser: 'Firefox',
    steps: [
      'Click the 🔒 lock icon in your address bar',
      'Find "Use the Camera" permission',
      'Click ✕ to clear the blocked state',
      'Reload the page and allow when prompted',
    ],
  },
]

function getRelevantSteps(
  permission: 'location' | 'camera',
  browser: BrowserHint,
): BrowserStep[] {
  const allSteps = permission === 'location' ? LOCATION_STEPS : CAMERA_STEPS

  // Show detected browser first, then the rest
  const browserMap: Record<BrowserHint, string> = {
    chrome: 'Chrome / Edge',
    safari: 'Safari',
    firefox: 'Firefox',
    other: '',
  }
  const detectedLabel = browserMap[browser]

  const sorted = [
    ...allSteps.filter((s) => s.browser.startsWith(detectedLabel)),
    ...allSteps.filter((s) => !s.browser.startsWith(detectedLabel)),
  ]
  return sorted
}

export function PermissionBlocker({ permission, onRetry }: PermissionBlockerProps) {
  const [browser] = useState<BrowserHint>(() => detectBrowser())
  const steps = getRelevantSteps(permission, browser)
  const isLocation = permission === 'location'

  // Auto-retry when the user returns to this tab after fixing settings
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        onRetry()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [onRetry])

  return (
    <div className="permission-blocker">
      <div className="permission-blocker__icon-wrap">
        {isLocation ? (
          <svg
            aria-hidden="true"
            className="permission-blocker__icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2a7 7 0 0 1 7 7c0 5.25-7 13-7 13S5 14.25 5 9a7 7 0 0 1 7-7z" />
            <line x1="2" y1="2" x2="22" y2="22" />
            <circle cx="12" cy="9" r="3" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            className="permission-blocker__icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <line x1="2" y1="2" x2="22" y2="22" />
          </svg>
        )}
      </div>

      <h2 className="permission-blocker__heading">
        {isLocation ? 'Location Access Blocked' : 'Camera Access Blocked'}
      </h2>

      <p className="permission-blocker__reason">
        {isLocation
          ? 'Your device location is required to verify that you are physically at the reported site and to reduce remote or false submissions.'
          : 'A live camera photo is required to submit a dengue breeding habitat report. The photo confirms the site exists and helps classify the habitat type.'}
      </p>

      <div className="permission-blocker__instructions">
        <p className="permission-blocker__instructions-label">How to re-enable</p>
        {steps.map((browserStep) => (
          <details key={browserStep.browser} className="permission-blocker__browser-block" open={steps.indexOf(browserStep) === 0}>
            <summary className="permission-blocker__browser-name">
              {browserStep.browser}
            </summary>
            <ol className="permission-blocker__steps">
              {browserStep.steps.map((step) => (
                <li key={step} className="permission-blocker__step">
                  {step}
                </li>
              ))}
            </ol>
          </details>
        ))}
      </div>

      <button
        type="button"
        className="permission-blocker__retry"
        onClick={onRetry}
      >
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
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
        I've updated settings — Try Again
      </button>
    </div>
  )
}
