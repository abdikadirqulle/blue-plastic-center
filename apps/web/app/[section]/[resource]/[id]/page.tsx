import { notFound } from "next/navigation";
import { ResourceDetailsPage } from "../../../../features/resources/resource-details-page";
import { resourceConfigs } from "../../../../features/resources/resource-config";

export default async function ResourceDetailsRoute({
  params,
}: {
  params: Promise<{ section: string; resource: string; id: string }>;
}) {
  const { section, resource, id } = await params;
  const config = resourceConfigs[`${section}/${resource}`];
  const row = config?.rows.find((item) => item.id === decodeURIComponent(id));

  if (!config || !row) notFound();

  return <ResourceDetailsPage config={config} row={row} />;
}
