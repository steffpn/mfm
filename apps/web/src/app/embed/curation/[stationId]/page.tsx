import { CurationPlayer } from "@/components/curation-player";

export default async function EmbedCurationPage({
  params,
}: {
  params: Promise<{ stationId: string }>;
}) {
  const { stationId } = await params;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <CurationPlayer stationId={stationId} showBranding />
    </div>
  );
}
