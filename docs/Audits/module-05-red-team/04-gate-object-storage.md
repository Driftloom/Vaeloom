# Gate 04 — Real Object Storage

## Verdict: FAIL

## Findings
| ID | Severity | File:Line | Description |
|----|----------|-----------|-------------|
| G04-1 | P0 | `apps/api/tests/test_module05_storage.py:30-34` | The storage tests do not connect to a real S3 or MinIO instance. They patch `_ensure_client` and use `MagicMock` for `boto3`. |
| G04-2 | INFO | `apps/api/src/api/services/storage_service.py:18-28` | TLS is not hard-coded to False; it uses `storage_use_ssl` or infers from the scheme, but this is never tested against real infrastructure. |

## Evidence
`apps/api/tests/test_module05_storage.py` line 30-34:
```python
    mock_s3 = MagicMock()
    mock_s3.put_object.return_value = {"ETag": '"hash"'}
    mock_s3.get_object.return_value = {"Body": MagicMock(read=lambda: b"mock-file-content")}

    with patch.object(svc, "_ensure_client"):
```

## Conclusion
The storage architecture is entirely untested against real object storage. The tests are superficial unit tests on mocked AWS clients.
