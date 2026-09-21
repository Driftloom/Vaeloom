# Gate 20 — Cache Isolation

## Verdict: FAIL

## Findings
| ID | Severity | File:Line | Description |
|---|---|---|---|
| 1 | P1 | `apps/api/src/api/services/cache_service.py:27` | Cache keys are not enforced to be namespaced by workspace_id within the `CacheService`. Any caller could use generic keys, leading to cross-workspace data bleed and cache poisoning. |
| 2 | P1 | `apps/api/tests/test_module05_chaos.py:10` | The chaos tests only verify fallback vector store and storage service missing scenarios. There is absolutely zero test coverage for Redis cache key isolation or cache poisoning. |

## Evidence
- `CacheService.get(self, key: str)` and `set(self, key: str, value: Any, ttl: int = 300)` blindly accept raw string keys without injecting or verifying any tenant prefixing.
- `test_module05_chaos.py` contains `test_vector_store_chaos_fallback`, `test_fallback_vector_store_safe_operations`, and `test_storage_service_missing_s3_graceful_handling`. None of these relate to caching.

## Conclusion
Cache isolation is not structurally guaranteed nor tested, invalidating the 100% production verified claim.
