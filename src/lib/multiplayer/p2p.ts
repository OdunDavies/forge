// experimental - gated behind VITE_ENABLE_P2P
// Full implementation removed for Phase 5 cleanup. Re-enable by restoring from git history and gating with VITE_ENABLE_P2P.

export type SignalKind = "offer" | "answer" | "ice";
export interface PeerRow { id: string; name: string; }
export interface SignalRow { id: number; from: string; kind: SignalKind; payload: unknown; }
export interface RtcPollResponse { peers: PeerRow[]; signals: SignalRow[]; }
export interface PeerInfo { id: string; name: string; connectionState: RTCPeerConnectionState; candidateType: string | null; rttMs: number | null; }
export interface P2PRoomOptions { room: string; selfId: string; name?: string; iceServers?: RTCIceServer[]; onPeersChanged?: (peers: PeerInfo[]) => void; onMessage?: (from: string, data: unknown, channel: "state" | "reliable") => void; onConnected?: () => void; }

const gated = () => (import.meta.env.VITE_ENABLE_P2P as string | undefined) === "true";

export function defaultIceServers(): RTCIceServer[] { return [{ urls: ["stun:stun.l.google.com:19302"] }]; }

export class P2PRoom {
  constructor(private readonly _opts: P2PRoomOptions) {
    if (!gated()) console.warn("[p2p] experimental - gated (set VITE_ENABLE_P2P=true to enable)");
  }
  async join(): Promise<void> { if (!gated()) return; }
  close(): void {}
  broadcast(_data: unknown): void {}
  send(_data: unknown, _peerId?: string): void {}
  peerList(): PeerInfo[] { return []; }
}
