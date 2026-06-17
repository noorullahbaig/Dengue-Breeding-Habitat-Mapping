import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/app/AppLayout'
import { HomePageV2 } from '@/pages/ux-v2/HomePageV2'
import { OfficerDashboardPageV2 } from '@/pages/ux-v2/OfficerDashboardPageV2'
import { PublicMapPageV2 } from '@/pages/ux-v2/PublicMapPageV2'
import { PublicReportDetailPageV2 } from '@/pages/ux-v2/PublicReportDetailPageV2'
import { LearnPageV2 } from '@/pages/ux-v2/LearnPageV2'
import { ReportPageV2 } from '@/pages/ux-v2/ReportPageV2'
import { ReportSuccessPageV2 } from '@/pages/ux-v2/ReportSuccessPageV2'
import { StatusPageV2 } from '@/pages/ux-v2/StatusPageV2'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePageV2 />} />
        <Route path="/report" element={<ReportPageV2 />} />
        <Route path="/report/success" element={<ReportSuccessPageV2 />} />
        <Route path="/status" element={<StatusPageV2 />} />
        <Route path="/learn" element={<LearnPageV2 />} />
        <Route path="/map" element={<PublicMapPageV2 />} />
        <Route path="/map/reports/:reference" element={<PublicReportDetailPageV2 />} />
        <Route path="/officer" element={<OfficerDashboardPageV2 />} />

        {/* Temporary redirects for any hardcoded /next legacy links */}
        <Route path="/next" element={<Navigate to="/" replace />} />
        <Route path="/next/report" element={<Navigate to="/report" replace />} />
        <Route path="/next/report/success" element={<Navigate to="/report/success" replace />} />
        <Route path="/next/status" element={<Navigate to="/status" replace />} />
        <Route path="/next/learn" element={<Navigate to="/learn" replace />} />
        <Route path="/next/map" element={<Navigate to="/map" replace />} />
        <Route path="/next/map/reports/:reference" element={<Navigate to="/map/reports/:reference" replace />} />
        <Route path="/next/officer" element={<Navigate to="/officer" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
