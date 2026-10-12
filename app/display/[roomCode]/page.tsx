import { DisplayScreen } from '../../../components/display-screen';
import { notFound } from 'next/navigation';

export default async function Page({ params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode } = await params;
  const normalized = roomCode.trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(normalized)) notFound();
  return <DisplayScreen roomCode={normalized} />;
}
