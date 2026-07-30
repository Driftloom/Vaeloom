# Plugin SDK

This guide explains how to create, test, and publish plugins for Vaeloom.

## Plugin Architecture

A Vaeloom plugin is a self-contained Python module that:

1. Defines its metadata (name, version, author, etc.)
2. Declares required permissions
3. Exports a `run(input: dict, context: dict) -> dict` function
4. Runs in a sandboxed subprocess with no network or file-system access

## Plugin Interface

### Metadata (required fields)

| Field        | Type     | Description |
|-------------|----------|-------------|
| `name`       | string   | Unique plugin name |
| `version`    | string   | Semver version |
| `author`     | string   | Author name |
| `description`| string   | Short description |
| `license`    | string   | SPDX license identifier |
| `entry_point`| string   | Module path (e.g. `my_plugin.main`) |
| `permissions`| object   | Declared permission scopes |
| `tags`       | string[] | Categorization tags |

### `run()` function

Your plugin **must** define a top-level `run(input, context)` function:

```python
def run(input: dict, context: dict) -> dict:
    """
    Args:
        input: The input payload passed during execution
        context: Execution context with tenantId, pluginId, permissions

    Returns:
        A dictionary with the plugin's output
    """
    text = input.get("text", "")
    word_count = len(text.split())
    return {"word_count": word_count}
```

### Available globals in sandbox

The sandbox provides a restricted set of Python builtins:

`abs`, `all`, `any`, `bool`, `dict`, `enumerate`, `filter`, `float`, `int`,
`isinstance`, `len`, `list`, `map`, `max`, `min`, `range`, `round`, `set`,
`sorted`, `str`, `sum`, `tuple`, `type`, `zip`

Additionally, the `input` and `context` variables are injected.

**Not available:** `open`, `eval`, `exec`, `import`, `__import__`, `os`,
`subprocess`, `socket`, `requests`, `pathlib`, network access, file I/O.

## Example: Word Count Plugin

This plugin counts words, characters, and sentences from input text:

```python
def run(input: dict, context: dict) -> dict:
    text = input.get("text", "")

    words = text.split()
    word_count = len(words)
    char_count = len(text)
    sentence_count = len([c for c in text if c in ".!?"])

    return {
        "word_count": word_count,
        "character_count": char_count,
        "sentence_count": sentence_count,
        "average_word_length": round(char_count / max(word_count, 1), 2),
    }
```

Register this plugin via the API:

```json
POST /api/v1/plugins
{
  "name": "word-count",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "Counts words, characters, and sentences",
  "license": "MIT",
  "min_app_version": "1.0.0",
  "tags": ["utility", "text"],
  "permissions": {},
  "capabilities": [],
  "hooks": [],
  "entry_point": "main",
  "code": "<your Python code here>"
}
```

## Testing a Plugin Locally

### Option 1: Use the sandbox script directly

```bash
echo '{"result": "hello"}' | python apps/backend/src/backend/services/plugin_sandbox.py
```

Set the `PLUGIN_CONTEXT` environment variable:

```bash
export PLUGIN_CONTEXT='{"input": {"text": "hello world"}, "tenantId": "demo"}'
echo '
def run(input, context):
    return {"word_count": len(input.get("text", "").split())}
' | python apps/backend/src/backend/services/plugin_sandbox.py
```

### Option 2: Use the Vaeloom API

```bash
curl -X POST http://localhost:8000/api/v1/plugins \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-plugin",
    "version": "1.0.0",
    "author": "You",
    "description": "My plugin",
    "license": "MIT",
    "min_app_version": "1.0.0",
    "tags": ["custom"],
    "permissions": {},
    "entry_point": "main",
    "code": "def run(input, context):\n    return {\"result\": input.get(\"text\", \"\").upper()}"
  }'
```

Then execute it:

```bash
curl -X POST http://localhost:8000/api/v1/plugins/PLUGIN_ID/execute \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"input": {"text": "hello world"}}'
```

### Option 3: Use the test suite

```python
from backend.services.plugin_sandbox import main
# See apps/backend/tests/test_plugin_service.py for examples
```

## Publishing a Plugin

To add a plugin to the Vaeloom plugin registry:

1. **Package your plugin** as a single Python file with a `run()` function
2. **Declare permissions** honestly — only request what you need
3. **Register** via the API or the Vaeloom admin interface
4. **Test** at multiple input sizes
5. **Tag appropriately** so users can discover it

### Plugin Permissions Reference

```json
{
  "memory": ["read", "write"],
  "agents": ["read"],
  "events": ["publish"],
  "storage": ["read"],
  "network": [],
  "files": []
}
```

| Scope     | Actions    | Description |
|-----------|-----------|-------------|
| `memory`  | read, write | Access memory store |
| `agents`  | read, write | Access agent configurations |
| `events`  | publish     | Publish custom events |
| `storage` | read, write | Access file storage |
| `network` | (reserved)  | Network access |
| `files`   | read, write | File system access |

If a plugin declares permissions it doesn't use during review, it may be
rejected. Always declare the minimal set of permissions needed.

## Plugin Lifecycle States

| State        | Description |
|-------------|-------------|
| `REGISTERED` | Plugin registered but not yet approved |
| `ACTIVE`     | Plugin approved and available for use |
| `DISABLED`   | Plugin disabled by administrator |
| `BANNED`     | Plugin permanently banned for policy violations |

## Best Practices

1. **Keep it stateless** — plugins run in ephemeral sandboxes
2. **Handle errors gracefully** — return descriptive error dictionaries
3. **Respect timeouts** — the default timeout is 5 seconds
4. **Be deterministic** — same input should produce same output
5. **Limit output size** — keep returned data under 1 MB
6. **Test edge cases** — empty strings, large inputs, special characters
