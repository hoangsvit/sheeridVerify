// A conservative per-peer limit for the local/public workbench login.
// Forwarded IP headers are intentionally ignored because proxies may be untrusted.
export class LoginThrottle {
  constructor({ maxFailures = 5, windowMs = 15 * 60_000, lockMs = 15 * 60_000,
    now = () => Date.now() } = {}) {
    this.maxFailures = maxFailures;
    this.windowMs = windowMs;
    this.lockMs = lockMs;
    this.now = now;
    this.clients = new Map();
  }

  retryAfterSeconds(client) {
    const entry = this.clients.get(client);
    if (!entry) return 0;
    const now = this.now();
    if (entry.lockedUntil > now) return Math.ceil((entry.lockedUntil - now) / 1000);
    if (entry.lockedUntil || now - entry.startedAt >= this.windowMs) this.clients.delete(client);
    return 0;
  }

  failure(client) {
    if (this.retryAfterSeconds(client)) return;
    const now = this.now();
    const entry = this.clients.get(client) ?? { startedAt: now, failures: 0, lockedUntil: 0 };
    entry.failures++;
    if (entry.failures >= this.maxFailures) entry.lockedUntil = now + this.lockMs;
    this.clients.set(client, entry);
    // Bound memory even under many arbitrary source addresses.
    if (this.clients.size > 4096) {
      for (const [key, value] of this.clients) {
        if (value.lockedUntil <= now && now - value.startedAt >= this.windowMs) this.clients.delete(key);
      }
      while (this.clients.size > 4096) this.clients.delete(this.clients.keys().next().value);
    }
  }

  success(client) {
    this.clients.delete(client);
  }
}
