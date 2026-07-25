import { notFound } from "next/navigation";
import { ReportsPage } from "../../../features/reports/reports-page";
import { ResourcePage } from "../../../features/resources/resource-page";
import { resourceConfigs } from "../../../features/resources/resource-config";
import { SettingsPage } from "../../../features/settings/settings-page";

export default async function ResourceRoute({
  params,
}: {
  params: Promise<{ section: string; resource: string }>;
}) {
  const { section, resource } = await params;

  if (section === "reports") {
    return <ReportsPage activeTab={resource} />;
  }

  if (section === "settings") {
    return <SettingsPage activeSection={resource} />;
  }

  const config = resourceConfigs[`${section}/${resource}`];

  if (!config) {
    notFound();
  }

  return <ResourcePage config={config} />;
}
