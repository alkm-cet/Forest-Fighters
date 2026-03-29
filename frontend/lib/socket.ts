import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function connectSocket(playerId: string): Socket {
  if (socket?.connected) return socket;

  socket = io(process.env.EXPO_PUBLIC_API_URL!, {
    transports: ["websocket"],
    reconnection: true,
    reconnectionDelay: 2000,
  });

  socket.on("connect", () => {
    socket!.emit("join", { playerId });
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
