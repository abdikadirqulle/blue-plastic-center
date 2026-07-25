import { notFound } from "next/navigation";
import { ResourcePage } from "../../../features/resources/resource-page";
import { resourceConfigs } from "../../../features/resources/resource-config";

export default async function ResourceRoute({
  params,
}: {
  params: Promise<{ section: string; resource: string }>;
}) {
  const { section, resource } = await params;
  const config = resourceConfigs[`${section}/${resource}`];

  if (!config) {
    notFound();
  }

  return <ResourcePage config={config} />;
}
