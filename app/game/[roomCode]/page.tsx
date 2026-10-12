import { GameScreen } from '../../../components/game-screen';

export default async function Page({ params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode } = await params;
  return <GameScreen roomCode={roomCode.toUpperCase()} />;
}
