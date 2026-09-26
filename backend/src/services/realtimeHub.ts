import crypto from 'node:crypto';

type RealtimeSocket = {
  OPEN: number; readyState: number;
  send(data: string): void;
  on(event: 'close' | 'error', listener: () => void): void;
};

/** In-process room hub. Use Redis/NATS adapter before running multiple API replicas. */
class RealtimeHub {
  private rooms = new Map<string, Set<RealtimeSocket>>();
  join(room: string, socket: RealtimeSocket) {
    const sockets = this.rooms.get(room) || new Set<RealtimeSocket>();
    sockets.add(socket); this.rooms.set(room, sockets);
    const leave = () => { sockets.delete(socket); if (!sockets.size) this.rooms.delete(room); };
    socket.on('close', leave); socket.on('error', leave);
  }
  publish(room: string, event: Record<string, unknown>) {
    const message = JSON.stringify({ id: crypto.randomUUID(), at: new Date().toISOString(), ...event });
    for (const socket of this.rooms.get(room) || []) if (socket.readyState === socket.OPEN) socket.send(message);
  }
}
export const realtimeHub = new RealtimeHub();
export const realtimeRooms = {
  branchPresence: (workspaceId: string, branchId: string) => `branch:${workspaceId}:${branchId}:presence`,
  team: (workspaceId: string) => `workspace:${workspaceId}:team`,
  context: (workspaceId: string) => `workspace:${workspaceId}:context`,
  onboarding: (flowId: string) => `onboarding:${flowId}`,
};
