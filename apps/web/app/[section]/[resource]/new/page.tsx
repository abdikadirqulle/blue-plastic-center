import { notFound } from "next/navigation";
import { ResourceFormPage } from "../../../../features/resources/resource-form-page";
import { resourceConfigs } from "../../../../features/resources/resource-config";

export default async function NewResourcePage({
  params,
}: {
  params: Promise<{ section: string; resource: string }>;
}) {
  const { section, resource } = await params;
  const config = resourceConfigs[`${section}/${resource}`];

  if (!config) notFound();

  return <ResourceFormPage config={config} />;
}
