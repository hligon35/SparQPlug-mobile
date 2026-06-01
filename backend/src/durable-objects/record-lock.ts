/// <reference types="@cloudflare/workers-types" />

interface Lock {
  entityId: string;
  entity: string;
  userId: string;
  lockedAt: string;
  expiresAt: number;
}

export class RecordLockDurableObject implements DurableObject {
  private locks: Map<string, Lock> = new Map();
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const action = url.pathname.split('/').pop();

    switch (action) {
      case 'acquire': return this.acquireLock(request);
      case 'release': return this.releaseLock(request);
      case 'status': return this.getLockStatus(request);
      default: return new Response('Not found', { status: 404 });
    }
  }

  private async acquireLock(request: Request): Promise<Response> {
    const { entityId, entity, userId } = await request.json() as { entityId: string; entity: string; userId: string };
    const key = `${entity}:${entityId}`;
    const existing = this.locks.get(key);

    if (existing && existing.userId !== userId && existing.expiresAt > Date.now()) {
      return new Response(JSON.stringify({ success: false, lockedBy: existing.userId, lockedAt: existing.lockedAt }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }

    const lock: Lock = { entityId, entity, userId, lockedAt: new Date().toISOString(), expiresAt: Date.now() + 30 * 60 * 1000 };
    this.locks.set(key, lock);
    return new Response(JSON.stringify({ success: true, lock }), { headers: { 'Content-Type': 'application/json' } });
  }

  private async releaseLock(request: Request): Promise<Response> {
    const { entityId, entity, userId } = await request.json() as { entityId: string; entity: string; userId: string };
    const key = `${entity}:${entityId}`;
    const existing = this.locks.get(key);

    if (!existing || existing.userId !== userId) {
      return new Response(JSON.stringify({ success: false, error: 'Lock not held by this user' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    this.locks.delete(key);
    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  }

  private async getLockStatus(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const entityId = url.searchParams.get('entityId') ?? '';
    const entity = url.searchParams.get('entity') ?? '';
    const key = `${entity}:${entityId}`;
    const lock = this.locks.get(key);

    if (!lock || lock.expiresAt <= Date.now()) {
      if (lock) this.locks.delete(key);
      return new Response(JSON.stringify({ locked: false }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ locked: true, lock }), { headers: { 'Content-Type': 'application/json' } });
  }
}
