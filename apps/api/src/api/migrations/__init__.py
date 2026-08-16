import importlib
import pkgutil

from .runner import MIGRATIONS, downgrade_to, get_applied_versions, run_migrations

for _module_info in pkgutil.iter_modules(__path__):
    if _module_info.name == "runner":
        continue
    _module = importlib.import_module(f"{__name__}.{_module_info.name}")
    MIGRATIONS[_module.VERSION] = _module

__all__ = ["MIGRATIONS", "downgrade_to", "get_applied_versions", "run_migrations"]
