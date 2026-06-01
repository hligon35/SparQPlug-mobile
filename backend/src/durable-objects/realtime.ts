/// <reference types="@cloudflare/workers-types" />

interface Session {
  userId: string;
  organizationId: string;
  ws: WebSocket;
}

export class RealtimeDurableObject implements DurableObject {
  private sessions: Map<string, Session> = new Map();
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get('Upgrade');

    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    await this.handleSession(server, url);

    return new Response(null, { status: 101, webSocket: client });
  }

  private async handleSession(ws: WebSocket, url: URL): Promise<void> {
    this.state.acceptWebSocket(ws);

    const sessionId = crypto.randomUUID();
    const userId = url.searchParams.get('userId') ?? 'anonymous';
    const organizationId = url.searchParams.get('orgId') ?? 'default';

    this.sessions.set(sessionId, { userId, organizationId, ws });

    // Notify others of new presence
    this.broadcast(
      {
        type: 'user.presence',
        data: { userId, status: 'online' },
        timestamp: new Date().toISOString(),
      },
      sessionId,
    );

    ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data as string) as Record<string, unknown>;
        this.handleMessage(sessionId, msg);
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.addEventListener('close', () => {
      this.sessions.delete(sessionId);
      this.broadcast(
        {
          type: 'user.presence',
          data: { userId, status: 'offline' },
          timestamp: new Date().toISOString(),
        },
        sessionId,
      );
    });
  }

  private handleMessage(sessionId: string, msg: Record<string, unknown>): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Broadcast the message to all sessions in the same org
    this.broadcast(
      {
        ...msg,
        userId: session.userId,
        timestamp: new Date().toISOString(),
      },
      sessionId,
    );
  }

  private broadcast(msg: unknown, excludeSessionId?: string): void {
    const data = JSON.stringify(msg);
    for (const [id, session] of this.sessions) {
      if (id !== excludeSessionId) {
        try {
          session.ws.send(data);
        } catch {
          this.sessions.delete(id);
        }
      }
    }
  }

  async webSocketMessage(ws: WebSocket, message: string): Promise<void> {
    // Handled by addEventListener above
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    // Handled by addEventListener above
  }
}
