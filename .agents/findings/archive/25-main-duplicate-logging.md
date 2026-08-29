# Finding: Duplicate Logging/Formatter Classes

| Metadata     | Value                                                      |
| ------------ | ---------------------------------------------------------- |
| **ID**       | FIND-MAIN-006                                              |
| **Severity** | P3-LOW                                                     |
| **Status**   | OPEN                                                       |
| **Source**   | main.py Audit                                              |
| **Files**    | `src/api/logging.py` + `src/api/infrastructure/logging.py` |

## Description

`StructuredJsonFormatter` and `PrettyFormatter` are defined in BOTH `logging.py`
and `infrastructure/logging.py`. Both files also define `setup_logging()` and
`get_logger()`. The root-level `logging.py` versions are dead code (main.py
imports from `infrastructure.logging`).

## Impact

- Confusion about which is authoritative
- Dead code maintenance burden
- Risk of divergent behavior if both are modified independently

## Remediation

Delete the root-level `logging.py` formatter classes. Keep only
`infrastructure/logging.py` as authoritative.
