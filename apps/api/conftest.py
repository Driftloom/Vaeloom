"""Top-level pytest configuration for the API test suite.

``tests/ci_integrity.py`` holds the CI forensics plugin. It is registered here
rather than in ``tests/conftest.py`` because ``pytest_plugins`` is only honoured
in the rootdir conftest, and xdist workers configure the plugin before they
collect ``tests/conftest.py``.

Both guards are opt-in and silent unless ``CI_INTEGRITY_DIR`` or
``--ci-watchdog-timeout`` is set, so local runs are unchanged.
"""

pytest_plugins = ["tests.ci_integrity"]
