import { Navigate, Route, Routes, useParams } from "react-router-dom"
import LoginPage from "../features/auth/login-page"
import { DashboardPage } from "../features/dashboard/components/dashboard-page"
import { EnterpriseWorkspacePage } from "../features/enterprise/components/enterprise-workspace-page"
import { ImportPage } from "../features/imports/import-page"
import NotificationsPage from "../features/notifications/notifications-page"
import { OperationsWorkspacePage } from "../features/operations/components/operations-workspace-page"
import ProfilePage from "../features/profile/profile-page"
import { ReportsPage } from "../features/reports/reports-page"
import { ResourceDetailsPage } from "../features/resources/resource-details-page"
import { ResourceFormPage } from "../features/resources/resource-form-page"
import { ResourcePage } from "../features/resources/resource-page"
import {
  moduleDefinitions,
  resourceConfigs,
} from "../features/resources/resource-config"
import { SalesWorkspacePage } from "../features/sales/components/sales-workspace-page"
import { SettingsPage } from "../features/settings/settings-page"

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
  if (section === "reports") return <ReportsPage activeTab={resource} />
  if (section === "settings") return <SettingsPage activeSection={resource} />
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
  const row = config?.rows.find((item) => item.id === decodeURIComponent(id))
  return config && row ? (
    <ResourceDetailsPage config={config} row={row} />
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
      <Route path="/" element={<DashboardPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/import" element={<ImportPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/:section/:resource/new" element={<ResourceFormRoute />} />
      <Route
        path="/:section/:resource/:id"
        element={<ResourceDetailsRoute />}
      />
      <Route path="/:section/:resource" element={<ResourceRoute />} />
      <Route path="/:section" element={<SectionRedirect />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
