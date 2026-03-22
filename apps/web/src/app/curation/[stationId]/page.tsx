import { CurationPlayer } from "@/components/curation-player";

export default async function CurationStationPage({
  params,
}: {
  params: Promise<{ stationId: string }>;
}) {
  const { stationId } = await params;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] py-8">
      <CurationPlayer stationId={stationId} />
    </div>
  );
}
