import { DisplayScreen } from '../../../components/display-screen';

export default async function Page({ params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode } = await params;
  return <DisplayScreen roomCode={roomCode.trim().toUpperCase()} />;
}
