// ─── ID Generation ────────────────────────────────────────────────────────────

export function generateId(): string {
  // Generate a URL-safe, collision-resistant ID using the Web Crypto API
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export function buildPagination(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasMore: page * limit < total,
  };
}

export function buildPaginatedResult<T>(items: T[], page: number, limit: number, total: number) {
  return {
    data: items,
    items,
    total,
    page,
    limit,
    hasMore: page * limit < total,
  };
}

// ─── Slug ─────────────────────────────────────────────────────────────────────

export function toSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────

export function nowISO(): string {
  return new Date().toISOString();
}
