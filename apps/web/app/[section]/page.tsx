import { notFound } from "next/navigation";
import { WorkspacePage } from "../../features/workspace/workspace-page";
import { workspaceConfigs } from "../../features/workspace/config";

export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const config = workspaceConfigs[section];

  if (!config) {
    notFound();
  }

  return <WorkspacePage section={config.slug} />;
}
