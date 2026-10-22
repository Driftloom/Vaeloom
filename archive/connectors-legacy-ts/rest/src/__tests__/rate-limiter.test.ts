import { TokenBucket } from '../rate-limiter';

describe('TokenBucket', () => {
  it('should allow consumption with available tokens', async () => {
    const bucket = new TokenBucket(10, 5, 100);
    await expect(bucket.consume(1)).resolves.toBeUndefined();
  });

  it('should block when tokens are exhausted', async () => {
    const bucket = new TokenBucket(2, 10, 50);
    await bucket.consume(2);
    expect(bucket.availableTokens).toBe(0);
  });

  it('should respect retry-after', () => {
    const bucket = new TokenBucket(10, 5, 100);
    bucket.setRetryAfter(5);
    expect(bucket.availableTokens).toBe(0);
  });
});
