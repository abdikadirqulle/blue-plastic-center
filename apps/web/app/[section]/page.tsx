import { notFound, redirect } from "next/navigation";
import { moduleDefinitions } from "../../features/resources/resource-config";

export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const moduleDefinition = moduleDefinitions[section];

  if (!moduleDefinition) {
    notFound();
  }

  redirect(`/${section}/${moduleDefinition.resources[0].slug}`);
}
