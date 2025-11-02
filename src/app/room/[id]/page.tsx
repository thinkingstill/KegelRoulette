export const runtime = "edge";
import RoomClient from "./RoomClient";

export default function RoomPage({ params }: { params: { id: string } }) {
  const roomId = params?.id;
  return <RoomClient roomId={roomId} />;
}