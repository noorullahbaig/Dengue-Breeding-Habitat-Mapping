import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppLayout } from '@/app/AppLayout'
import { ReportOverlay } from '@/app/ReportOverlay'
import type { ReportRouteState } from '@/app/reportOverlayState'
import { useMobileViewport } from '@/app/useMobileViewport'
import { HomePageV2 } from '@/pages/ux-v2/HomePageV2'
import { LoadingState } from '@/components/ui'

const ActivityPageV2 = lazy(() =>
  import('@/pages/ux-v2/ActivityPageV2').then((module) => ({ default: module.ActivityPageV2 })),
)
const ProfilePageV2 = lazy(() =>
  import('@/pages/ux-v2/ProfilePageV2').then((module) => ({ default: module.ProfilePageV2 })),
)
const PublicMapPageV2 = lazy(() =>
  import('@/pages/ux-v2/PublicMapPageV2').then((module) => ({ default: module.PublicMapPageV2 })),
)
const OfficerDashboardPageV2 = lazy(() =>
  import('@/pages/ux-v2/OfficerDashboardPageV2').then((module) => ({
    default: module.OfficerDashboardPageV2,
  })),
)
const PublicReportDetailPageV2 = lazy(() =>
  import('@/pages/ux-v2/PublicReportDetailPageV2').then((module) => ({
    default: module.PublicReportDetailPageV2,
  })),
)
const LearnPageV2 = lazy(() =>
  import('@/pages/ux-v2/LearnPageV2').then((module) => ({ default: module.LearnPageV2 })),
)
const ReportPageV2 = lazy(() =>
  import('@/pages/ux-v2/ReportPageV2').then((module) => ({ default: module.ReportPageV2 })),
)
const ReportSuccessPageV2 = lazy(() =>
  import('@/pages/ux-v2/ReportSuccessPageV2').then((module) => ({ default: module.ReportSuccessPageV2 })),
)
const StatusPageV2 = lazy(() =>
  import('@/pages/ux-v2/StatusPageV2').then((module) => ({ default: module.StatusPageV2 })),
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
      <Route element={<AppLayout />}>
        <Route index element={<HomePageV2 />} />
        <Route path="/report" element={<ReportPageV2 />} />
        <Route path="/report/success" element={<ReportSuccessPageV2 />} />
        <Route path="/activity" element={<ActivityPageV2 />} />
        <Route path="/profile" element={<ProfilePageV2 />} />
        <Route path="/status" element={<StatusPageV2 />} />
        <Route path="/learn" element={<LearnPageV2 />} />
        <Route path="/map" element={<PublicMapPageV2 />} />
        <Route path="/map/reports/:reference" element={<PublicReportDetailPageV2 />} />
        <Route path="/officer" element={<OfficerDashboardPageV2 />} />

        {/* Temporary redirects for any hardcoded /next legacy links */}
        <Route path="/next" element={<Navigate to="/" replace />} />
        <Route path="/next/report" element={<Navigate to="/report" replace />} />
        <Route path="/next/report/success" element={<Navigate to="/report/success" replace />} />
        <Route path="/next/activity" element={<Navigate to="/activity" replace />} />
        <Route path="/next/profile" element={<Navigate to="/profile" replace />} />
        <Route path="/next/status" element={<Navigate to="/status" replace />} />
        <Route path="/next/learn" element={<Navigate to="/learn" replace />} />
        <Route path="/next/map" element={<Navigate to="/map" replace />} />
        <Route path="/next/map/reports/:reference" element={<Navigate to="/map/reports/:reference" replace />} />
        <Route path="/next/officer" element={<Navigate to="/officer" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    {showReportOverlay ? (
      <ReportOverlay routeState={routeState}>
        {(closeReportOverlay) => (
          <ReportPageV2 isOverlay onRequestClose={closeReportOverlay} />
        )}
      </ReportOverlay>
    ) : null}
    </Suspense>
  )
}
