import yaml
from pathlib import Path
from typing import Union
from vaeloom_agent_contracts import AgentManifest


class ManifestLoadError(Exception):
    pass


def load_manifest_from_yaml(yaml_content_or_path: Union[str, Path]) -> AgentManifest:
    """Loads and validates an agent.yaml manifest against the canonical AgentManifest contract."""
    try:
        if isinstance(yaml_content_or_path, Path) or (isinstance(yaml_content_or_path, str) and "\n" not in yaml_content_or_path and Path(yaml_content_or_path).exists()):
            with open(yaml_content_or_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
        else:
            data = yaml.safe_load(yaml_content_or_path)
            
        if not isinstance(data, dict):
            raise ManifestLoadError("Manifest YAML root must be a dictionary")
            
        return AgentManifest.model_validate(data)
    except Exception as e:
        raise ManifestLoadError(f"Failed to validate agent manifest: {e}")
