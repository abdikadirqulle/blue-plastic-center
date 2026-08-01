import { Navigate, Outlet, Route, Routes, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { isNavigableResource } from "@blue-plastic/types"
import LoginPage from "../features/auth/login-page"
import { DashboardPage } from "../features/dashboard/components/dashboard-page"
import { EnterpriseWorkspacePage } from "../features/enterprise/components/enterprise-workspace-page"
import { ImportPage } from "../features/imports/import-page"
import NotificationsPage from "../features/notifications/notifications-page"
import { OperationsWorkspacePage } from "../features/operations/components/operations-workspace-page"
import ProfilePage from "../features/profile/profile-page"
import { ReportsPage } from "../features/reports/reports-page"
import { ReportViewerPage } from "../features/reports/report-viewer-page"
import { ResourceDetailsPage } from "../features/resources/resource-details-page"
import { ResourceFormPage } from "../features/resources/resource-form-page"
import { ResourcePage } from "../features/resources/resource-page"
import {
  moduleDefinitions,
  resourceConfigs,
} from "../features/resources/resource-config"
import { SalesWorkspacePage } from "../features/sales/components/sales-workspace-page"
import { SettingsPage } from "../features/settings/settings-page"
import { TrashPage } from "../features/trash/trash-page"
import { authService } from "../features/auth/auth-service"
import { queryKeys } from "../lib/query-client"

function ProtectedRoute() {
  const session = useQuery({
    queryKey: queryKeys.session,
    queryFn: () => authService.me(),
    retry: false,
  })
  //   if (session.isLoading)
  //     return (
  //       <main className="grid min-h-screen place-items-center bg-[#f4f7fa]">
  //         <div className="flex items-center gap-3 text-sm text-[#607681]">
  //           <span className="size-5 animate-spin rounded-full border-2 border-[#c9d7df] border-t-[#007DCC]" />
  //           <span>Opening your workspace…</span>
  //         </div>
  //       </main>
  //     )
  return session.isError ? <Navigate to="/login" replace /> : <Outlet />
}

function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f7fa] p-6">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-[#007DCC]">
          404
        </p>
        <h1 className="mt-3 text-3xl font-bold text-[#17303d]">
          Page not found
        </h1>
        <a
          href="/"
          className="mt-5 inline-flex rounded-xl bg-[#007DCC] px-4 py-2.5 text-xs font-bold text-white"
        >
          Return to dashboard
        </a>
      </div>
    </main>
  )
}

function SectionRedirect() {
  const { section = "" } = useParams()
  const firstResource = moduleDefinitions[section]?.resources[0]?.slug
  return firstResource ? (
    <Navigate to={`/${section}/${firstResource}`} replace />
  ) : (
    <NotFoundPage />
  )
}

function ResourceRoute() {
  const { section = "", resource = "" } = useParams()
  // Reports and settings render their own shells, so they are checked against
  // the MVP scope here; every other section is gated by `resourceConfigs`,
  // which only contains in-scope resources.
  if (section === "reports" || section === "settings") {
    if (!isNavigableResource(section, resource)) return <NotFoundPage />
    return section === "reports" ? (
      <ReportsPage activeTab={resource} />
    ) : (
      <SettingsPage activeSection={resource} />
    )
  }
  const config = resourceConfigs[`${section}/${resource}`]
  if (!config) return <NotFoundPage />
  if (section === "sales")
    return <SalesWorkspacePage key={`${section}/${resource}`} config={config} />
  if (["purchasing", "inventory", "banking"].includes(section))
    return (
      <OperationsWorkspacePage key={`${section}/${resource}`} config={config} />
    )
  if (["accounting", "projects", "payroll"].includes(section))
    return (
      <EnterpriseWorkspacePage key={`${section}/${resource}`} config={config} />
    )
  return <ResourcePage key={`${section}/${resource}`} config={config} />
}

function ResourceDetailsRoute() {
  const { section = "", resource = "", id = "" } = useParams()
  const config = resourceConfigs[`${section}/${resource}`]
  return config ? (
    <ResourceDetailsPage config={config} id={decodeURIComponent(id)} />
  ) : (
    <NotFoundPage />
  )
}

function ResourceFormRoute() {
  const { section = "", resource = "" } = useParams()
  const config = resourceConfigs[`${section}/${resource}`]
  return config ? <ResourceFormPage config={config} /> : <NotFoundPage />
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/trash" element={<TrashPage />} />
        <Route path="/reports/view" element={<ReportViewerPage />} />
        <Route path="/:section/:resource/new" element={<ResourceFormRoute />} />
        <Route
          path="/:section/:resource/:id"
          element={<ResourceDetailsRoute />}
        />
        <Route path="/:section/:resource" element={<ResourceRoute />} />
        <Route path="/:section" element={<SectionRedirect />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
