export class TokenBucket {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number;
  private refillInterval: number;
  private lastRefill: number;

  constructor(maxTokens: number = 60, refillRate: number = 1, refillInterval: number = 1000) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.refillInterval = refillInterval;
    this.lastRefill = Date.now();
  }

  async consume(count: number = 1): Promise<void> {
    this.refill();

    if (this.tokens < count) {
      const waitTime = Math.ceil(((count - this.tokens) / this.refillRate) * this.refillInterval);
      await this.delay(waitTime);
      this.refill();
    }

    this.tokens = Math.max(0, this.tokens - count);
  }

  setRetryAfter(seconds: number): void {
    this.tokens = 0;
    this.lastRefill = Date.now() + seconds * 1000;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed <= 0) return;

    const tokensToAdd = Math.floor((elapsed / this.refillInterval) * this.refillRate);
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  get availableTokens(): number {
    this.refill();
    return this.tokens;
  }
}
