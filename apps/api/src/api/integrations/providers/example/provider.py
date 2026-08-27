"""
Example provider — copy this folder to add a new integration.

Steps:
1. Copy providers/example → providers/my_service
2. Edit provider.py: set id, display_name, scopes, tool_names
3. Create ToolDefinitions in tools/definitions.py or return them from tool_definitions()
4. Implement handlers in tools/executor.py and wire via provider's handle()
5. Add client in clients/my_service_client.py if needed
6. Register in provider_registry.discover_and_register() or call register() at import time.

This example registers no real tools — it demonstrates the pattern.
"""
from api.integrations.registry import provider_registry

provider_registry.register(
    id="example",
    display_name="Example Integration (template)",
    scopes=["connector.example.read"],
    tool_names=["example_tool"],
    module="api.integrations.providers.example.provider",
)
