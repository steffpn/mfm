import { CurationLeaderboard } from "@/components/curation-leaderboard";

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ stationId: string }>;
}) {
  const { stationId } = await params;

  return (
    <div className="py-8">
      <CurationLeaderboard stationId={stationId} />
    </div>
  );
}
