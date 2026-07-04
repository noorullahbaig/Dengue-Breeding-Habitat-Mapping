import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppLayout } from '@/app/AppLayout'
import { ReportOverlay } from '@/app/ReportOverlay'
import type { ReportRouteState } from '@/app/reportOverlayState'
import { useMobileViewport } from '@/app/useMobileViewport'
import { HomePage } from '@/pages/HomePage'
import { LoadingState } from '@/components/ui'

const ActivityPage = lazy(() =>
  import('@/pages/ActivityPage').then((module) => ({ default: module.ActivityPage })),
)
const ProfilePage = lazy(() =>
  import('@/pages/ProfilePage').then((module) => ({ default: module.ProfilePage })),
)
const PublicMapPage = lazy(() =>
  import('@/pages/PublicMapPage').then((module) => ({ default: module.PublicMapPage })),
)
const PublicReportDetailPage = lazy(() =>
  import('@/pages/PublicReportDetailPage').then((module) => ({
    default: module.PublicReportDetailPage,
  })),
)
const LearnPage = lazy(() =>
  import('@/pages/LearnPage').then((module) => ({ default: module.LearnPage })),
)
const ReportPage = lazy(() =>
  import('@/pages/ReportPage').then((module) => ({ default: module.ReportPage })),
)
const ReportSuccessPage = lazy(() =>
  import('@/pages/ReportSuccessPage').then((module) => ({ default: module.ReportSuccessPage })),
)
const StatusPage = lazy(() =>
  import('@/pages/StatusPage').then((module) => ({ default: module.StatusPage })),
)

export function AppRoutes() {
  const location = useLocation()
  const isMobile = useMobileViewport()
  const routeState = (location.state ?? {}) as ReportRouteState
  const showReportOverlay = isMobile && location.pathname === '/report'
  const routeLocation = showReportOverlay
    ? routeState.reportBackgroundLocation ?? '/'
    : location

  return (
    <Suspense fallback={<LoadingState label="Loading view…" />}>
    <Routes location={routeLocation}>
      {/* Standalone routes — no app shell */}

      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/report/success" element={<ReportSuccessPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/learn" element={<LearnPage />} />
        <Route path="/map" element={<PublicMapPage />} />
        <Route path="/map/reports/:reference" element={<PublicReportDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    {showReportOverlay ? (
      <ReportOverlay routeState={routeState}>
        {(closeReportOverlay) => (
          <ReportPage isOverlay onRequestClose={closeReportOverlay} />
        )}
      </ReportOverlay>
    ) : null}
    </Suspense>
  )
}
