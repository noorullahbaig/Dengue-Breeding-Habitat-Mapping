import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/app/AppLayout'
import { HomePage } from '@/pages/HomePage'
import { OfficerPlaceholderPage } from '@/pages/OfficerPlaceholderPage'
import { PublicReportDetailPage } from '@/pages/PublicReportDetailPage'
import { PublicMapPage } from '@/pages/PublicMapPage'
import { ReportPage } from '@/pages/ReportPage'
import { ReportReviewPage } from '@/pages/ReportReviewPage'
import { ReportSuccessPage } from '@/pages/ReportSuccessPage'
import { StatusPage } from '@/pages/StatusPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/report/review" element={<ReportReviewPage />} />
        <Route path="/report/success" element={<ReportSuccessPage />} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/map" element={<PublicMapPage />} />
        <Route path="/map/reports/:reference" element={<PublicReportDetailPage />} />
        <Route path="/officer" element={<OfficerPlaceholderPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
