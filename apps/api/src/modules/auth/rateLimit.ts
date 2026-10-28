interface Window {
  failures: number;
  resetAt: number;
}

/** Omezí počet neúspěšných přihlášení na klíč (IP + jméno) v časovém okně. */
export class LoginRateLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly maxFailures: number,
    private readonly windowMs: number,
  ) {}

  isBlocked(key: string, now: number): boolean {
    const window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      this.windows.delete(key);
      return false;
    }
    return window.failures >= this.maxFailures;
  }

  recordFailure(key: string, now: number): void {
    const window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      this.windows.set(key, { failures: 1, resetAt: now + this.windowMs });
      return;
    }
    window.failures += 1;
  }

  reset(key: string): void {
    this.windows.delete(key);
  }
}
