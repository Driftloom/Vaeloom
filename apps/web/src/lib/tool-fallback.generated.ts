/**
 * GENERATED FILE -- DO NOT EDIT BY HAND.
 *
 * Source of truth: `ALL_TOOLS` in `apps/api/src/api/tools/definitions.py`.
 * Every row in `TOOL_FALLBACK` is rendered from a `ToolDefinition` -- the same
 * definitions the running backend serves -- so the workbench fallback cannot
 * drift from what the API actually accepts.
 *
 * Copied verbatim (JSON-escaped): name, description, requiredScope, trustClass,
 * inputSchema, outputSchema. The only derived fields are:
 *   - `id`:          `tool-` + the tool name with underscores dashed
 *   - `tags`:        the backend `category` and `trust_class`, title-cased
 *   - `markdownDoc`: tool name, backend description, required scope
 * Nothing else here is invented from the UI side.
 *
 * Regenerate:  `uv run --project apps/api python scripts/gen_tool_fallback.py`
 * Verify:      `uv run --project apps/api python scripts/gen_tool_fallback.py --check`
 *
 * Rows follow `ALL_TOOLS` insertion order -- the order is part of the diff, as
 * with `memory.generated.ts`.
 */

import type { CapabilityItem } from './capabilities-data';

export const TOOL_FALLBACK: readonly CapabilityItem[] = [
  {
    "id": "tool-search-documents",
    "name": "search_documents",
    "category": "tools",
    "tags": [
      "Memory Read",
      "First Party"
    ],
    "description": "Search across user documents with semantic search",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "memory.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string"
        },
        "limit": {
          "type": "integer",
          "default": 10
        }
      },
      "required": [
        "query"
      ]
    },
    "outputSchema": {
      "type": "array",
      "items": {
        "$ref": "Document"
      }
    },
    "markdownDoc": "# search_documents\n\nSearch across user documents with semantic search\n\n### Permissions\n\nRequires `memory.read`.\n"
  },
  {
    "id": "tool-query-graph",
    "name": "query_graph",
    "category": "tools",
    "tags": [
      "Memory Read",
      "First Party"
    ],
    "description": "Query the knowledge graph for entities and relationships",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "memory.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string"
        },
        "entity_type": {
          "type": "string",
          "default": "any"
        },
        "limit": {
          "type": "integer",
          "default": 20
        }
      },
      "required": [
        "query"
      ]
    },
    "outputSchema": {
      "type": "array",
      "items": {
        "$ref": "GraphNode"
      }
    },
    "markdownDoc": "# query_graph\n\nQuery the knowledge graph for entities and relationships\n\n### Permissions\n\nRequires `memory.read`.\n"
  },
  {
    "id": "tool-get-entity",
    "name": "get_entity",
    "category": "tools",
    "tags": [
      "Memory Read",
      "First Party"
    ],
    "description": "Retrieve a specific entity by ID from the knowledge graph",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "memory.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "entity_id": {
          "type": "string"
        }
      },
      "required": [
        "entity_id"
      ]
    },
    "outputSchema": {
      "$ref": "GraphNode"
    },
    "markdownDoc": "# get_entity\n\nRetrieve a specific entity by ID from the knowledge graph\n\n### Permissions\n\nRequires `memory.read`.\n"
  },
  {
    "id": "tool-create-entity",
    "name": "create_entity",
    "category": "tools",
    "tags": [
      "Memory Write",
      "First Party"
    ],
    "description": "Create a new entity in the knowledge graph",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "memory.write",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string"
        },
        "entity_type": {
          "type": "string"
        },
        "properties": {
          "type": "object"
        }
      },
      "required": [
        "name",
        "entity_type"
      ]
    },
    "outputSchema": {
      "$ref": "GraphNode"
    },
    "markdownDoc": "# create_entity\n\nCreate a new entity in the knowledge graph\n\n### Permissions\n\nRequires `memory.write`.\n"
  },
  {
    "id": "tool-merge-entities",
    "name": "merge_entities",
    "category": "tools",
    "tags": [
      "Memory Write",
      "First Party"
    ],
    "description": "Merge two duplicate entities in the knowledge graph",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "memory.write",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "source_id": {
          "type": "string"
        },
        "target_id": {
          "type": "string"
        }
      },
      "required": [
        "source_id",
        "target_id"
      ]
    },
    "outputSchema": {
      "$ref": "GraphNode"
    },
    "markdownDoc": "# merge_entities\n\nMerge two duplicate entities in the knowledge graph\n\n### Permissions\n\nRequires `memory.write`.\n"
  },
  {
    "id": "tool-categorize-document",
    "name": "categorize_document",
    "category": "tools",
    "tags": [
      "Memory Write",
      "First Party"
    ],
    "description": "Assign a category and folder to a document",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "memory.write",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "document_id": {
          "type": "string"
        },
        "category": {
          "type": "string"
        },
        "folder": {
          "type": "string"
        }
      },
      "required": [
        "document_id",
        "category"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "status": {
          "type": "string"
        }
      }
    },
    "markdownDoc": "# categorize_document\n\nAssign a category and folder to a document\n\n### Permissions\n\nRequires `memory.write`.\n"
  },
  {
    "id": "tool-search-memories",
    "name": "search_memories",
    "category": "tools",
    "tags": [
      "Memory Read",
      "First Party"
    ],
    "description": "Search workspace semantic memories and user knowledge base facts. Uses hybrid vector+keyword retrieval with rank fusion.",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "memory.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string"
        },
        "category": {
          "type": "string",
          "default": "all",
          "description": "Memory type to narrow by, or 'all'. Valid: profile, document, career, episodic, preference, working, note, fact, project, skill, organization, relationship, event, insight, goal, feedback, decision, knowledge, reference, contact, financial, health, learning, workflow."
        },
        "limit": {
          "type": "integer",
          "default": 10
        },
        "strategy": {
          "type": "string",
          "enum": [
            "hybrid",
            "vector",
            "keyword"
          ],
          "default": "hybrid",
          "description": "hybrid fuses vector and keyword results via RRF; vector is semantic only; keyword is exact-text only."
        },
        "include_superseded": {
          "type": "boolean",
          "default": false,
          "description": "Include superseded history so corrections stay auditable."
        }
      },
      "required": [
        "query"
      ]
    },
    "outputSchema": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "title": {
            "type": "string"
          },
          "summary": {
            "type": "string"
          },
          "content": {
            "type": "string"
          },
          "category": {
            "type": "string"
          },
          "source_type": {
            "type": "string"
          },
          "tags": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "created_at": {
            "type": "string"
          },
          "score": {
            "type": "number",
            "description": "Real retrieval score from rank fusion; rank by it."
          }
        }
      }
    },
    "markdownDoc": "# search_memories\n\nSearch workspace semantic memories and user knowledge base facts. Uses hybrid vector+keyword retrieval with rank fusion.\n\n### Permissions\n\nRequires `memory.read`.\n"
  },
  {
    "id": "tool-create-memory",
    "name": "create_memory",
    "category": "tools",
    "tags": [
      "Memory Write",
      "First Party"
    ],
    "description": "Create or store a persistent memory, fact, or user preference in the workspace",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "memory.write",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "content": {
          "type": "string"
        },
        "category": {
          "type": "string",
          "default": "preference",
          "description": "Memory type. Valid: profile, document, career, episodic, preference, working, note, fact, project, skill, organization, relationship, event, insight, goal, feedback, decision, knowledge, reference, contact, financial, health, learning, workflow. An unrecognised value is stored as 'note'."
        },
        "confidence": {
          "type": "number",
          "default": 1.0
        }
      },
      "required": [
        "content"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "status": {
          "type": "string"
        },
        "type": {
          "type": "string"
        },
        "embedded": {
          "type": "boolean",
          "description": "False when no vector backend was available, so the memory is stored but will not match semantic search yet."
        }
      }
    },
    "markdownDoc": "# create_memory\n\nCreate or store a persistent memory, fact, or user preference in the workspace\n\n### Permissions\n\nRequires `memory.write`.\n"
  },
  {
    "id": "tool-sync-vault",
    "name": "sync_vault",
    "category": "tools",
    "tags": [
      "Memory Write",
      "First Party"
    ],
    "description": "Record a manual vault sync request and report current vault state; the desktop vaultsync client performs the git pull/rebase/commit/push cycle (there is no server-side sync engine)",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "memory.write",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "force": {
          "type": "boolean",
          "default": false,
          "description": "Deprecated no-op: sync execution belongs to the desktop vaultsync client."
        }
      },
      "required": []
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "success": {
          "type": "boolean"
        },
        "executed": {
          "type": "boolean"
        },
        "workspace_id": {
          "type": "string"
        },
        "daemon_status": {
          "type": "string"
        },
        "files_found": {
          "type": "integer"
        },
        "last_pull_time": {
          "type": "string"
        },
        "last_push_time": {
          "type": "string"
        },
        "conflicts_count": {
          "type": "integer"
        },
        "message": {
          "type": "string"
        }
      }
    },
    "markdownDoc": "# sync_vault\n\nRecord a manual vault sync request and report current vault state; the desktop vaultsync client performs the git pull/rebase/commit/push cycle (there is no server-side sync engine)\n\n### Permissions\n\nRequires `memory.write`.\n"
  },
  {
    "id": "tool-ingest-vault-notes",
    "name": "ingest_vault_notes",
    "category": "tools",
    "tags": [
      "Memory Write",
      "First Party"
    ],
    "description": "Parse and ingest vault markdown notes into structured memories and entities",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "memory.write",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "auto_extract_entities": {
          "type": "boolean",
          "default": true
        }
      },
      "required": []
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "status": {
          "type": "string"
        },
        "notes_processed": {
          "type": "integer"
        },
        "memories_created": {
          "type": "integer"
        },
        "entities_extracted": {
          "type": "integer"
        }
      }
    },
    "markdownDoc": "# ingest_vault_notes\n\nParse and ingest vault markdown notes into structured memories and entities\n\n### Permissions\n\nRequires `memory.write`.\n"
  },
  {
    "id": "tool-get-document-content",
    "name": "get_document_content",
    "category": "tools",
    "tags": [
      "Memory Read",
      "First Party"
    ],
    "description": "Retrieve safe plain text content of a workspace document by ID with token/character bounding",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "memory.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "document_id": {
          "type": "string"
        },
        "max_chars": {
          "type": "integer",
          "default": 10000
        }
      },
      "required": [
        "document_id"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "document_id": {
          "type": "string"
        },
        "title": {
          "type": "string"
        },
        "content": {
          "type": "string"
        },
        "chars_returned": {
          "type": "integer"
        }
      }
    },
    "markdownDoc": "# get_document_content\n\nRetrieve safe plain text content of a workspace document by ID with token/character bounding\n\n### Permissions\n\nRequires `memory.read`.\n"
  },
  {
    "id": "tool-list-workspace-folders",
    "name": "list_workspace_folders",
    "category": "tools",
    "tags": [
      "Memory Read",
      "First Party"
    ],
    "description": "List all folders and directories in the workspace",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "memory.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "parent_id": {
          "type": "string",
          "description": "Optional parent folder ID"
        }
      },
      "required": []
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "folders": {
          "type": "array"
        },
        "count": {
          "type": "integer"
        }
      }
    },
    "markdownDoc": "# list_workspace_folders\n\nList all folders and directories in the workspace\n\n### Permissions\n\nRequires `memory.read`.\n"
  },
  {
    "id": "tool-create-workspace-folder",
    "name": "create_workspace_folder",
    "category": "tools",
    "tags": [
      "System",
      "First Party"
    ],
    "description": "Create a new directory folder in the workspace",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "workspace.write",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string"
        },
        "parent_id": {
          "type": "string"
        }
      },
      "required": [
        "name"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "name": {
          "type": "string"
        },
        "path": {
          "type": "string"
        }
      }
    },
    "markdownDoc": "# create_workspace_folder\n\nCreate a new directory folder in the workspace\n\n### Permissions\n\nRequires `workspace.write`.\n"
  },
  {
    "id": "tool-get-document-version",
    "name": "get_document_version",
    "category": "tools",
    "tags": [
      "Memory Read",
      "First Party"
    ],
    "description": "Retrieve revision history snapshots and checksums for a document",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "memory.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "document_id": {
          "type": "string"
        }
      },
      "required": [
        "document_id"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "document_id": {
          "type": "string"
        },
        "versions": {
          "type": "array"
        }
      }
    },
    "markdownDoc": "# get_document_version\n\nRetrieve revision history snapshots and checksums for a document\n\n### Permissions\n\nRequires `memory.read`.\n"
  },
  {
    "id": "tool-restore-document-version",
    "name": "restore_document_version",
    "category": "tools",
    "tags": [
      "System",
      "First Party"
    ],
    "description": "Restore an older revision snapshot as the active document version",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "workspace.write",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "document_id": {
          "type": "string"
        },
        "version_id": {
          "type": "string"
        }
      },
      "required": [
        "document_id",
        "version_id"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "status": {
          "type": "string"
        },
        "document_id": {
          "type": "string"
        },
        "restored_version": {
          "type": "integer"
        }
      }
    },
    "markdownDoc": "# restore_document_version\n\nRestore an older revision snapshot as the active document version\n\n### Permissions\n\nRequires `workspace.write`.\n"
  },
  {
    "id": "tool-share-workspace-document",
    "name": "share_workspace_document",
    "category": "tools",
    "tags": [
      "System",
      "First Party"
    ],
    "description": "Grant explicit view or edit access on a document to another workspace",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "workspace.write",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "document_id": {
          "type": "string"
        },
        "target_workspace_id": {
          "type": "string"
        },
        "permission": {
          "type": "string",
          "enum": [
            "view",
            "edit"
          ],
          "default": "view"
        }
      },
      "required": [
        "document_id",
        "target_workspace_id"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "share_id": {
          "type": "string"
        },
        "document_id": {
          "type": "string"
        },
        "target_workspace_id": {
          "type": "string"
        }
      }
    },
    "markdownDoc": "# share_workspace_document\n\nGrant explicit view or edit access on a document to another workspace\n\n### Permissions\n\nRequires `workspace.write`.\n"
  },
  {
    "id": "tool-get-document-audit-history",
    "name": "get_document_audit_history",
    "category": "tools",
    "tags": [
      "Memory Read",
      "First Party"
    ],
    "description": "Retrieve immutable audit action log (renames, archives, restores) for a document",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "memory.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "document_id": {
          "type": "string"
        }
      },
      "required": [
        "document_id"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "actions": {
          "type": "array"
        },
        "count": {
          "type": "integer"
        }
      }
    },
    "markdownDoc": "# get_document_audit_history\n\nRetrieve immutable audit action log (renames, archives, restores) for a document\n\n### Permissions\n\nRequires `memory.read`.\n"
  },
  {
    "id": "tool-search-gmail",
    "name": "search_gmail",
    "category": "tools",
    "tags": [
      "Connector Read",
      "First Party"
    ],
    "description": "Search the user's Gmail for emails matching a query",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.gmail.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string"
        },
        "max_results": {
          "type": "integer",
          "default": 20
        },
        "after_date": {
          "type": "string",
          "format": "date"
        }
      },
      "required": [
        "query"
      ]
    },
    "outputSchema": {
      "type": "array",
      "items": {
        "$ref": "Email"
      }
    },
    "markdownDoc": "# search_gmail\n\nSearch the user's Gmail for emails matching a query\n\n### Permissions\n\nRequires `connector.gmail.read`.\n"
  },
  {
    "id": "tool-search-jobs",
    "name": "search_jobs",
    "category": "tools",
    "tags": [
      "Connector Read",
      "First Party"
    ],
    "description": "Search connected job platforms for matching roles",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.jobs.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "keywords": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "location": {
          "type": "string"
        },
        "remote_ok": {
          "type": "boolean",
          "default": true
        },
        "limit": {
          "type": "integer",
          "default": 20
        }
      },
      "required": [
        "keywords"
      ]
    },
    "outputSchema": {
      "type": "array",
      "items": {
        "$ref": "JobPosting"
      }
    },
    "markdownDoc": "# search_jobs\n\nSearch connected job platforms for matching roles\n\n### Permissions\n\nRequires `connector.jobs.read`.\n"
  },
  {
    "id": "tool-list-calendar-events",
    "name": "list_calendar_events",
    "category": "tools",
    "tags": [
      "Connector Read",
      "First Party"
    ],
    "description": "List calendar events in a date range",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.calendar.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "start_date": {
          "type": "string",
          "format": "date"
        },
        "end_date": {
          "type": "string",
          "format": "date"
        }
      },
      "required": [
        "start_date",
        "end_date"
      ]
    },
    "outputSchema": {
      "type": "array",
      "items": {
        "$ref": "CalendarEvent"
      }
    },
    "markdownDoc": "# list_calendar_events\n\nList calendar events in a date range\n\n### Permissions\n\nRequires `connector.calendar.read`.\n"
  },
  {
    "id": "tool-list-drive-files",
    "name": "list_drive_files",
    "category": "tools",
    "tags": [
      "Connector Read",
      "First Party"
    ],
    "description": "List files in Google Drive (name, mimeType, size, modifiedTime)",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.drive.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "Drive query (e.g. \"trashed = false\")",
          "default": "trashed = false"
        },
        "page_size": {
          "type": "integer",
          "default": 50
        }
      },
      "required": []
    },
    "outputSchema": {
      "type": "array",
      "items": {
        "type": "object"
      }
    },
    "markdownDoc": "# list_drive_files\n\nList files in Google Drive (name, mimeType, size, modifiedTime)\n\n### Permissions\n\nRequires `connector.drive.read`.\n"
  },
  {
    "id": "tool-search-drive",
    "name": "search_drive",
    "category": "tools",
    "tags": [
      "Connector Read",
      "First Party"
    ],
    "description": "Full-text search across Google Drive files",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.drive.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "Search terms for fullText search"
        },
        "page_size": {
          "type": "integer",
          "default": 20
        }
      },
      "required": [
        "query"
      ]
    },
    "outputSchema": {
      "type": "array",
      "items": {
        "type": "object"
      }
    },
    "markdownDoc": "# search_drive\n\nFull-text search across Google Drive files\n\n### Permissions\n\nRequires `connector.drive.read`.\n"
  },
  {
    "id": "tool-download-drive-file",
    "name": "download_drive_file",
    "category": "tools",
    "tags": [
      "Connector Read",
      "First Party"
    ],
    "description": "Download a Google Drive file by file ID (binary content; Google Docs auto-exported as PDF)",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.drive.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "file_id": {
          "type": "string",
          "description": "Drive file ID"
        },
        "mime_type": {
          "type": "string",
          "description": "Export MIME for Google Docs (default application/pdf)"
        }
      },
      "required": [
        "file_id"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "file_id": {
          "type": "string"
        },
        "name": {
          "type": "string"
        },
        "size_bytes": {
          "type": "integer"
        },
        "content_base64": {
          "type": "string"
        }
      }
    },
    "markdownDoc": "# download_drive_file\n\nDownload a Google Drive file by file ID (binary content; Google Docs auto-exported as PDF)\n\n### Permissions\n\nRequires `connector.drive.read`.\n"
  },
  {
    "id": "tool-create-google-doc",
    "name": "create_google_doc",
    "category": "tools",
    "tags": [
      "Connector Write",
      "First Party"
    ],
    "description": "Create a new Google Document via Google Docs API",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.docs.write",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "title": {
          "type": "string",
          "description": "Title of the new document"
        },
        "initial_text": {
          "type": "string",
          "description": "Optional initial text/content to insert",
          "default": ""
        }
      },
      "required": [
        "title"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "document_id": {
          "type": "string"
        },
        "title": {
          "type": "string"
        },
        "url": {
          "type": "string"
        }
      }
    },
    "markdownDoc": "# create_google_doc\n\nCreate a new Google Document via Google Docs API\n\n### Permissions\n\nRequires `connector.docs.write`.\n"
  },
  {
    "id": "tool-read-google-doc",
    "name": "read_google_doc",
    "category": "tools",
    "tags": [
      "Connector Read",
      "First Party"
    ],
    "description": "Read full content of a Google Document via Docs API (returns clean structured Markdown/text)",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.docs.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "document_id": {
          "type": "string",
          "description": "Google Document ID"
        }
      },
      "required": [
        "document_id"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "document_id": {
          "type": "string"
        },
        "title": {
          "type": "string"
        },
        "content": {
          "type": "string"
        }
      }
    },
    "markdownDoc": "# read_google_doc\n\nRead full content of a Google Document via Docs API (returns clean structured Markdown/text)\n\n### Permissions\n\nRequires `connector.docs.read`.\n"
  },
  {
    "id": "tool-append-google-doc",
    "name": "append_google_doc",
    "category": "tools",
    "tags": [
      "Connector Write",
      "First Party"
    ],
    "description": "Append text or section to an existing Google Document via Docs API",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.docs.write",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "document_id": {
          "type": "string",
          "description": "Google Document ID"
        },
        "text": {
          "type": "string",
          "description": "Text to append"
        }
      },
      "required": [
        "document_id",
        "text"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "status": {
          "type": "string"
        },
        "document_id": {
          "type": "string"
        }
      }
    },
    "markdownDoc": "# append_google_doc\n\nAppend text or section to an existing Google Document via Docs API\n\n### Permissions\n\nRequires `connector.docs.write`.\n"
  },
  {
    "id": "tool-replace-google-doc-text",
    "name": "replace_google_doc_text",
    "category": "tools",
    "tags": [
      "Connector Write",
      "First Party"
    ],
    "description": "Replace placeholder text (e.g. {{candidate_name}}) in a Google Document via Docs API",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.docs.write",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "document_id": {
          "type": "string",
          "description": "Google Document ID"
        },
        "find_text": {
          "type": "string",
          "description": "Text or placeholder to search for"
        },
        "replace_text": {
          "type": "string",
          "description": "Replacement text"
        },
        "match_case": {
          "type": "boolean",
          "default": true
        }
      },
      "required": [
        "document_id",
        "find_text",
        "replace_text"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "status": {
          "type": "string"
        },
        "document_id": {
          "type": "string"
        }
      }
    },
    "markdownDoc": "# replace_google_doc_text\n\nReplace placeholder text (e.g. {{candidate_name}}) in a Google Document via Docs API\n\n### Permissions\n\nRequires `connector.docs.write`.\n"
  },
  {
    "id": "tool-search-greenhouse-jobs",
    "name": "search_greenhouse_jobs",
    "category": "tools",
    "tags": [
      "Connector Read",
      "First Party"
    ],
    "description": "Search Greenhouse boards (public, no auth) \u2014 supply board_token (e.g. 'openai', 'datadog')",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.jobs.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "board_token": {
          "type": "string",
          "description": "Greenhouse board token / company slug"
        },
        "keywords": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "location": {
          "type": "string"
        },
        "limit": {
          "type": "integer",
          "default": 20
        }
      },
      "required": [
        "board_token"
      ]
    },
    "outputSchema": {
      "type": "array",
      "items": {
        "type": "object"
      }
    },
    "markdownDoc": "# search_greenhouse_jobs\n\nSearch Greenhouse boards (public, no auth) \u2014 supply board_token (e.g. 'openai', 'datadog')\n\n### Permissions\n\nRequires `connector.jobs.read`.\n"
  },
  {
    "id": "tool-search-lever-jobs",
    "name": "search_lever_jobs",
    "category": "tools",
    "tags": [
      "Connector Read",
      "First Party"
    ],
    "description": "Search Lever postings (public, no auth) \u2014 supply company slug (e.g. 'lever', 'netflix')",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.jobs.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "company": {
          "type": "string",
          "description": "Lever company slug"
        },
        "keywords": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "location": {
          "type": "string"
        },
        "limit": {
          "type": "integer",
          "default": 20
        }
      },
      "required": [
        "company"
      ]
    },
    "outputSchema": {
      "type": "array",
      "items": {
        "type": "object"
      }
    },
    "markdownDoc": "# search_lever_jobs\n\nSearch Lever postings (public, no auth) \u2014 supply company slug (e.g. 'lever', 'netflix')\n\n### Permissions\n\nRequires `connector.jobs.read`.\n"
  },
  {
    "id": "tool-search-jobs-board",
    "name": "search_jobs_board",
    "category": "tools",
    "tags": [
      "Connector Read",
      "First Party"
    ],
    "description": "Unified job board search \u2014 fans out to Greenhouse + Lever (public) + generic board; aggregates results",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.jobs.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "board_token": {
          "type": "string",
          "description": "Optional Greenhouse board; if omitted uses Lever company fallback"
        },
        "company": {
          "type": "string",
          "description": "Optional Lever company slug"
        },
        "keywords": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "location": {
          "type": "string"
        },
        "limit": {
          "type": "integer",
          "default": 20
        }
      },
      "required": []
    },
    "outputSchema": {
      "type": "array",
      "items": {
        "type": "object"
      }
    },
    "markdownDoc": "# search_jobs_board\n\nUnified job board search \u2014 fans out to Greenhouse + Lever (public) + generic board; aggregates results\n\n### Permissions\n\nRequires `connector.jobs.read`.\n"
  },
  {
    "id": "tool-search-outlook-mail",
    "name": "search_outlook_mail",
    "category": "tools",
    "tags": [
      "Connector Read",
      "First Party"
    ],
    "description": "Search Outlook mail via Microsoft Graph (/me/messages, $search)",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.outlook.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string"
        },
        "max_results": {
          "type": "integer",
          "default": 20
        }
      },
      "required": [
        "query"
      ]
    },
    "outputSchema": {
      "type": "array",
      "items": {
        "type": "object"
      }
    },
    "markdownDoc": "# search_outlook_mail\n\nSearch Outlook mail via Microsoft Graph (/me/messages, $search)\n\n### Permissions\n\nRequires `connector.outlook.read`.\n"
  },
  {
    "id": "tool-draft-outlook-mail",
    "name": "draft_outlook_mail",
    "category": "tools",
    "tags": [
      "Connector Write",
      "First Party"
    ],
    "description": "Draft Outlook mail via Graph (never sends \u2014 user approves in Outlook)",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.outlook.write",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "to": {
          "type": "string"
        },
        "subject": {
          "type": "string"
        },
        "body": {
          "type": "string"
        }
      },
      "required": [
        "to",
        "subject",
        "body"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "draft_id": {
          "type": "string"
        }
      }
    },
    "markdownDoc": "# draft_outlook_mail\n\nDraft Outlook mail via Graph (never sends \u2014 user approves in Outlook)\n\n### Permissions\n\nRequires `connector.outlook.write`.\n"
  },
  {
    "id": "tool-list-outlook-calendar-events",
    "name": "list_outlook_calendar_events",
    "category": "tools",
    "tags": [
      "Connector Read",
      "First Party"
    ],
    "description": "List Outlook calendar events in a date range via Microsoft Graph",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.calendar.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "start_date": {
          "type": "string",
          "format": "date"
        },
        "end_date": {
          "type": "string",
          "format": "date"
        }
      },
      "required": [
        "start_date",
        "end_date"
      ]
    },
    "outputSchema": {
      "type": "array",
      "items": {
        "type": "object"
      }
    },
    "markdownDoc": "# list_outlook_calendar_events\n\nList Outlook calendar events in a date range via Microsoft Graph\n\n### Permissions\n\nRequires `connector.calendar.read`.\n"
  },
  {
    "id": "tool-create-outlook-calendar-event",
    "name": "create_outlook_calendar_event",
    "category": "tools",
    "tags": [
      "Connector Write",
      "First Party"
    ],
    "description": "Create Outlook calendar event via Graph (approval-gated)",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.calendar.write",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "title": {
          "type": "string"
        },
        "start_time": {
          "type": "string",
          "format": "date-time"
        },
        "end_time": {
          "type": "string",
          "format": "date-time"
        },
        "description": {
          "type": "string"
        }
      },
      "required": [
        "title",
        "start_time"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "event_id": {
          "type": "string"
        }
      }
    },
    "markdownDoc": "# create_outlook_calendar_event\n\nCreate Outlook calendar event via Graph (approval-gated)\n\n### Permissions\n\nRequires `connector.calendar.write`.\n"
  },
  {
    "id": "tool-list-onedrive-files",
    "name": "list_onedrive_files",
    "category": "tools",
    "tags": [
      "Connector Read",
      "First Party"
    ],
    "description": "List OneDrive files via Microsoft Graph (/me/drive/root/children)",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.drive.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "default": ""
        },
        "page_size": {
          "type": "integer",
          "default": 50
        }
      },
      "required": []
    },
    "outputSchema": {
      "type": "array",
      "items": {
        "type": "object"
      }
    },
    "markdownDoc": "# list_onedrive_files\n\nList OneDrive files via Microsoft Graph (/me/drive/root/children)\n\n### Permissions\n\nRequires `connector.drive.read`.\n"
  },
  {
    "id": "tool-search-onedrive",
    "name": "search_onedrive",
    "category": "tools",
    "tags": [
      "Connector Read",
      "First Party"
    ],
    "description": "Full-text search OneDrive via Graph (/me/drive/root/search)",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.drive.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string"
        },
        "page_size": {
          "type": "integer",
          "default": 20
        }
      },
      "required": [
        "query"
      ]
    },
    "outputSchema": {
      "type": "array",
      "items": {
        "type": "object"
      }
    },
    "markdownDoc": "# search_onedrive\n\nFull-text search OneDrive via Graph (/me/drive/root/search)\n\n### Permissions\n\nRequires `connector.drive.read`.\n"
  },
  {
    "id": "tool-download-onedrive-file",
    "name": "download_onedrive_file",
    "category": "tools",
    "tags": [
      "Connector Read",
      "First Party"
    ],
    "description": "Download OneDrive file by item ID via Graph (/me/drive/items/{id}/content)",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.drive.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "file_id": {
          "type": "string"
        }
      },
      "required": [
        "file_id"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "file_id": {
          "type": "string"
        },
        "name": {
          "type": "string"
        },
        "size_bytes": {
          "type": "integer"
        },
        "content_base64": {
          "type": "string"
        }
      }
    },
    "markdownDoc": "# download_onedrive_file\n\nDownload OneDrive file by item ID via Graph (/me/drive/items/{id}/content)\n\n### Permissions\n\nRequires `connector.drive.read`.\n"
  },
  {
    "id": "tool-rename-file",
    "name": "rename_file",
    "category": "tools",
    "tags": [
      "Connector Write",
      "First Party"
    ],
    "description": "Rename a file in the user's workspace",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.write",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "document_id": {
          "type": "string"
        },
        "new_name": {
          "type": "string"
        }
      },
      "required": [
        "document_id",
        "new_name"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "status": {
          "type": "string"
        }
      }
    },
    "markdownDoc": "# rename_file\n\nRename a file in the user's workspace\n\n### Permissions\n\nRequires `connector.write`.\n"
  },
  {
    "id": "tool-move-file",
    "name": "move_file",
    "category": "tools",
    "tags": [
      "Connector Write",
      "First Party"
    ],
    "description": "Move a file to a different folder in the workspace",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.write",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "document_id": {
          "type": "string"
        },
        "target_folder": {
          "type": "string"
        }
      },
      "required": [
        "document_id",
        "target_folder"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "status": {
          "type": "string"
        }
      }
    },
    "markdownDoc": "# move_file\n\nMove a file to a different folder in the workspace\n\n### Permissions\n\nRequires `connector.write`.\n"
  },
  {
    "id": "tool-draft-email",
    "name": "draft_email",
    "category": "tools",
    "tags": [
      "Connector Write",
      "First Party"
    ],
    "description": "Draft an email response (never sends \u2014 user must approve)",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.gmail.write",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "to": {
          "type": "string"
        },
        "subject": {
          "type": "string"
        },
        "body": {
          "type": "string"
        },
        "reply_to_id": {
          "type": "string"
        }
      },
      "required": [
        "to",
        "subject",
        "body"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "draft_id": {
          "type": "string"
        }
      }
    },
    "markdownDoc": "# draft_email\n\nDraft an email response (never sends \u2014 user must approve)\n\n### Permissions\n\nRequires `connector.gmail.write`.\n"
  },
  {
    "id": "tool-create-calendar-event",
    "name": "create_calendar_event",
    "category": "tools",
    "tags": [
      "Connector Write",
      "First Party"
    ],
    "description": "Create a calendar event (requires user approval unless reminder-only)",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.calendar.write",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "title": {
          "type": "string"
        },
        "start_time": {
          "type": "string",
          "format": "date-time"
        },
        "end_time": {
          "type": "string",
          "format": "date-time"
        },
        "description": {
          "type": "string"
        }
      },
      "required": [
        "title",
        "start_time"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "event_id": {
          "type": "string"
        }
      }
    },
    "markdownDoc": "# create_calendar_event\n\nCreate a calendar event (requires user approval unless reminder-only)\n\n### Permissions\n\nRequires `connector.calendar.write`.\n"
  },
  {
    "id": "tool-notify-user",
    "name": "notify_user",
    "category": "tools",
    "tags": [
      "System",
      "First Party"
    ],
    "description": "Send a notification to the user",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "system.notify",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "message": {
          "type": "string"
        },
        "priority": {
          "type": "string",
          "enum": [
            "low",
            "medium",
            "high",
            "urgent"
          ]
        }
      },
      "required": [
        "message"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "delivered": {
          "type": "boolean"
        }
      }
    },
    "markdownDoc": "# notify_user\n\nSend a notification to the user\n\n### Permissions\n\nRequires `system.notify`.\n"
  },
  {
    "id": "tool-compile-resume-pdf",
    "name": "compile_resume_pdf",
    "category": "tools",
    "tags": [
      "System",
      "First Party"
    ],
    "description": "Compile structured resume JSON into a styled PDF (via Playwright Chromium, template-aware, page-fit). Returns artifact bytes metadata or simulation when Chromium unavailable.",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "system.document.compile",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "template_slug": {
          "type": "string",
          "description": "One of classic-harvard, tech-modern, executive-leadership, minimalist-clean, creative-portfolio",
          "default": "minimalist-clean"
        },
        "resume_content": {
          "type": "object",
          "description": "Canonical resume_content dict (normalize_resume_content schema). If omitted, master resume for workspace is used"
        },
        "resume_id": {
          "type": "string",
          "description": "Optional resume ID to load content from DB when resume_content not supplied"
        },
        "max_pages": {
          "type": "integer",
          "default": 2,
          "description": "Page budget for auto-shrink fit loop"
        }
      },
      "required": []
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "media_type": {
          "type": "string"
        },
        "extension": {
          "type": "string"
        },
        "size_bytes": {
          "type": "integer"
        },
        "template": {
          "type": "string"
        }
      }
    },
    "markdownDoc": "# compile_resume_pdf\n\nCompile structured resume JSON into a styled PDF (via Playwright Chromium, template-aware, page-fit). Returns artifact bytes metadata or simulation when Chromium unavailable.\n\n### Permissions\n\nRequires `system.document.compile`.\n"
  },
  {
    "id": "tool-compile-resume-docx",
    "name": "compile_resume_docx",
    "category": "tools",
    "tags": [
      "System",
      "First Party"
    ],
    "description": "Compile structured resume JSON into an editable Word .docx (python-docx, ATS-parseable).",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "system.document.compile",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "template_slug": {
          "type": "string",
          "default": "minimalist-clean"
        },
        "resume_content": {
          "type": "object",
          "description": "Canonical resume_content dict. If omitted, master resume for workspace is used"
        },
        "resume_id": {
          "type": "string"
        }
      },
      "required": []
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "media_type": {
          "type": "string"
        },
        "extension": {
          "type": "string"
        },
        "size_bytes": {
          "type": "integer"
        }
      }
    },
    "markdownDoc": "# compile_resume_docx\n\nCompile structured resume JSON into an editable Word .docx (python-docx, ATS-parseable).\n\n### Permissions\n\nRequires `system.document.compile`.\n"
  },
  {
    "id": "tool-compile-cover-letter",
    "name": "compile_cover_letter",
    "category": "tools",
    "tags": [
      "System",
      "First Party"
    ],
    "description": "Compile a cover letter (resume header + body) into PDF/DOCX/HTML via the resume template engine.",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "system.document.compile",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "template_slug": {
          "type": "string",
          "default": "minimalist-clean"
        },
        "resume_content": {
          "type": "object"
        },
        "resume_id": {
          "type": "string"
        },
        "body": {
          "type": "string",
          "description": "Letter body text (paragraphs separated by blank lines)"
        },
        "company": {
          "type": "string"
        },
        "role": {
          "type": "string"
        },
        "recipient": {
          "type": "string"
        },
        "format": {
          "type": "string",
          "enum": [
            "pdf",
            "docx",
            "html"
          ],
          "default": "pdf"
        }
      },
      "required": []
    },
    "outputSchema": {
      "type": "object"
    },
    "markdownDoc": "# compile_cover_letter\n\nCompile a cover letter (resume header + body) into PDF/DOCX/HTML via the resume template engine.\n\n### Permissions\n\nRequires `system.document.compile`.\n"
  },
  {
    "id": "tool-web-search",
    "name": "web_search",
    "category": "tools",
    "tags": [
      "System",
      "First Party"
    ],
    "description": "Real-time web search for company news, salaries, and industry trends",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "system.web_search",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "Search query"
        },
        "limit": {
          "type": "integer",
          "default": 10
        },
        "domain": {
          "type": "string",
          "description": "Optional domain filter e.g. linkedin.com"
        }
      },
      "required": [
        "query"
      ]
    },
    "outputSchema": {
      "type": "array",
      "items": {
        "type": "object"
      }
    },
    "markdownDoc": "# web_search\n\nReal-time web search for company news, salaries, and industry trends\n\n### Permissions\n\nRequires `system.web_search`.\n"
  },
  {
    "id": "tool-parse-document-ocr",
    "name": "parse_document_ocr",
    "category": "tools",
    "tags": [
      "Memory Read",
      "First Party"
    ],
    "description": "Extract structured text from PDFs, DOCX, scanned images, certificates",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "memory.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "document_id": {
          "type": "string"
        },
        "filename": {
          "type": "string"
        },
        "extract_tables": {
          "type": "boolean",
          "default": false
        }
      },
      "required": [
        "document_id"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "text": {
          "type": "string"
        },
        "tables": {
          "type": "array"
        }
      }
    },
    "markdownDoc": "# parse_document_ocr\n\nExtract structured text from PDFs, DOCX, scanned images, certificates\n\n### Permissions\n\nRequires `memory.read`.\n"
  },
  {
    "id": "tool-calculate-ats-diff",
    "name": "calculate_ats_diff",
    "category": "tools",
    "tags": [
      "Memory Read",
      "First Party"
    ],
    "description": "Compute granular diffs between master resume and target job descriptions",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "memory.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "resume_text": {
          "type": "string"
        },
        "job_description": {
          "type": "string"
        },
        "keywords": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "resume_text",
        "job_description"
      ]
    },
    "outputSchema": {
      "type": "object"
    },
    "markdownDoc": "# calculate_ats_diff\n\nCompute granular diffs between master resume and target job descriptions\n\n### Permissions\n\nRequires `memory.read`.\n"
  },
  {
    "id": "tool-calculate-semantic-ats-score",
    "name": "calculate_semantic_ats_score",
    "category": "tools",
    "tags": [
      "Memory Read",
      "First Party"
    ],
    "description": "Score resume-to-job-description compatibility 0-100 using embedding cosine similarity plus keyword frequency matching",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "memory.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "resume_text": {
          "type": "string"
        },
        "job_description": {
          "type": "string"
        },
        "target_title": {
          "type": "string"
        }
      },
      "required": [
        "resume_text",
        "job_description"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "score": {
          "type": "number"
        },
        "semantic_similarity": {
          "type": "number"
        },
        "keyword_match_pct": {
          "type": "number"
        },
        "matched_keywords": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "missing_keywords": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      }
    },
    "markdownDoc": "# calculate_semantic_ats_score\n\nScore resume-to-job-description compatibility 0-100 using embedding cosine similarity plus keyword frequency matching\n\n### Permissions\n\nRequires `memory.read`.\n"
  },
  {
    "id": "tool-extract-missing-hard-skills",
    "name": "extract_missing_hard_skills",
    "category": "tools",
    "tags": [
      "Memory Read",
      "First Party"
    ],
    "description": "Identify technical skills, certifications, and tooling present in a job description but missing from the resume",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "memory.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "resume_text": {
          "type": "string"
        },
        "job_description": {
          "type": "string"
        }
      },
      "required": [
        "resume_text",
        "job_description"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "missing_skills": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "present_skills": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "certifications": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      }
    },
    "markdownDoc": "# extract_missing_hard_skills\n\nIdentify technical skills, certifications, and tooling present in a job description but missing from the resume\n\n### Permissions\n\nRequires `memory.read`.\n"
  },
  {
    "id": "tool-audit-ats-formatting",
    "name": "audit_ats_formatting",
    "category": "tools",
    "tags": [
      "Memory Read",
      "First Party"
    ],
    "description": "Scan resume text/markdown for ATS parser failure points: tables, non-standard headers, invalid date formats, graphics",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "memory.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "resume_markdown": {
          "type": "string"
        }
      },
      "required": [
        "resume_markdown"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "issues": {
          "type": "array",
          "items": {
            "type": "object"
          }
        },
        "passed": {
          "type": "boolean"
        }
      }
    },
    "markdownDoc": "# audit_ats_formatting\n\nScan resume text/markdown for ATS parser failure points: tables, non-standard headers, invalid date formats, graphics\n\n### Permissions\n\nRequires `memory.read`.\n"
  },
  {
    "id": "tool-browse-job-page",
    "name": "browse_job_page",
    "category": "tools",
    "tags": [
      "Connector Read",
      "First Party"
    ],
    "description": "Open a public job-posting URL in a headless browser and extract structured data: title, company, description, requirements, skills",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "system.browser.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "url": {
          "type": "string",
          "description": "Public https URL of the job posting"
        }
      },
      "required": [
        "url"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "title": {
          "type": "string"
        },
        "company": {
          "type": "string"
        },
        "description": {
          "type": "string"
        },
        "requirements": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "skills_mentioned": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      }
    },
    "markdownDoc": "# browse_job_page\n\nOpen a public job-posting URL in a headless browser and extract structured data: title, company, description, requirements, skills\n\n### Permissions\n\nRequires `system.browser.read`.\n"
  },
  {
    "id": "tool-scrape-company-insights",
    "name": "scrape_company_insights",
    "category": "tools",
    "tags": [
      "Connector Read",
      "First Party"
    ],
    "description": "Aggregate web intelligence about a company: culture, recent news and funding, interview questions, and engineering tech stack",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "system.browser.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "company_name": {
          "type": "string"
        }
      },
      "required": [
        "company_name"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "culture": {
          "type": "array"
        },
        "news_funding": {
          "type": "array"
        },
        "interview_questions": {
          "type": "array"
        },
        "tech_stack": {
          "type": "array"
        }
      }
    },
    "markdownDoc": "# scrape_company_insights\n\nAggregate web intelligence about a company: culture, recent news and funding, interview questions, and engineering tech stack\n\n### Permissions\n\nRequires `system.browser.read`.\n"
  },
  {
    "id": "tool-verify-application-link",
    "name": "verify_application_link",
    "category": "tools",
    "tags": [
      "Connector Read",
      "First Party"
    ],
    "description": "Check that an application URL is live before the user applies \u2014 cheap HEAD probe (GET fallback), never renders the page",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "system.browser.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "url": {
          "type": "string",
          "description": "Public https application URL"
        }
      },
      "required": [
        "url"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "reachable": {
          "type": "boolean"
        },
        "status_code": {
          "type": "integer"
        },
        "final_url": {
          "type": "string"
        }
      }
    },
    "markdownDoc": "# verify_application_link\n\nCheck that an application URL is live before the user applies \u2014 cheap HEAD probe (GET fallback), never renders the page\n\n### Permissions\n\nRequires `system.browser.read`.\n"
  },
  {
    "id": "tool-fetch-github-repo",
    "name": "fetch_github_repo",
    "category": "tools",
    "tags": [
      "Connector Read",
      "First Party"
    ],
    "description": "Fetch commits, PRs, repos, and issues from GitHub API",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.github.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "repo": {
          "type": "string",
          "description": "owner/repo"
        },
        "resource": {
          "type": "string",
          "enum": [
            "repo",
            "commits",
            "pulls",
            "issues",
            "profile"
          ],
          "default": "repo"
        },
        "username": {
          "type": "string",
          "description": "GitHub username for profile resource"
        },
        "limit": {
          "type": "integer",
          "default": 20
        }
      },
      "required": [
        "repo"
      ]
    },
    "outputSchema": {
      "type": "object"
    },
    "markdownDoc": "# fetch_github_repo\n\nFetch commits, PRs, repos, and issues from GitHub API\n\n### Permissions\n\nRequires `connector.github.read`.\n"
  },
  {
    "id": "tool-create-github-issue",
    "name": "create_github_issue",
    "category": "tools",
    "tags": [
      "Connector Write",
      "First Party"
    ],
    "description": "Create GitHub issues/PRs (approval-gated)",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.github.write",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "repo": {
          "type": "string",
          "description": "owner/repo"
        },
        "title": {
          "type": "string"
        },
        "body": {
          "type": "string"
        },
        "labels": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "repo",
        "title"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "issue_id": {
          "type": "string"
        },
        "url": {
          "type": "string"
        }
      }
    },
    "markdownDoc": "# create_github_issue\n\nCreate GitHub issues/PRs (approval-gated)\n\n### Permissions\n\nRequires `connector.github.write`.\n"
  },
  {
    "id": "tool-search-github-repos",
    "name": "search_github_repos",
    "category": "tools",
    "tags": [
      "Connector Read",
      "First Party"
    ],
    "description": "Search GitHub repositories by query (stars, topic, language)",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.github.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "Search query, e.g. 'fastapi stars:>1000'"
        },
        "sort": {
          "type": "string",
          "enum": [
            "stars",
            "forks",
            "updated"
          ],
          "default": "stars"
        },
        "order": {
          "type": "string",
          "enum": [
            "asc",
            "desc"
          ],
          "default": "desc"
        },
        "limit": {
          "type": "integer",
          "default": 10
        }
      },
      "required": [
        "query"
      ]
    },
    "outputSchema": {
      "type": "array",
      "items": {
        "type": "object"
      }
    },
    "markdownDoc": "# search_github_repos\n\nSearch GitHub repositories by query (stars, topic, language)\n\n### Permissions\n\nRequires `connector.github.read`.\n"
  },
  {
    "id": "tool-get-github-profile",
    "name": "get_github_profile",
    "category": "tools",
    "tags": [
      "Connector Read",
      "First Party"
    ],
    "description": "Get public GitHub profile, repos stats and contribution summary",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.github.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "username": {
          "type": "string",
          "description": "GitHub username"
        }
      },
      "required": [
        "username"
      ]
    },
    "outputSchema": {
      "type": "object"
    },
    "markdownDoc": "# get_github_profile\n\nGet public GitHub profile, repos stats and contribution summary\n\n### Permissions\n\nRequires `connector.github.read`.\n"
  },
  {
    "id": "tool-list-github-issues",
    "name": "list_github_issues",
    "category": "tools",
    "tags": [
      "Connector Read",
      "First Party"
    ],
    "description": "List issues for a repo (open/closed/all) with pagination",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.github.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "repo": {
          "type": "string",
          "description": "owner/repo"
        },
        "state": {
          "type": "string",
          "enum": [
            "open",
            "closed",
            "all"
          ],
          "default": "open"
        },
        "limit": {
          "type": "integer",
          "default": 20
        }
      },
      "required": [
        "repo"
      ]
    },
    "outputSchema": {
      "type": "array"
    },
    "markdownDoc": "# list_github_issues\n\nList issues for a repo (open/closed/all) with pagination\n\n### Permissions\n\nRequires `connector.github.read`.\n"
  },
  {
    "id": "tool-read-github-file",
    "name": "read_github_file",
    "category": "tools",
    "tags": [
      "Connector Read",
      "First Party"
    ],
    "description": "Read a file's content from a GitHub repo (branch aware, base64 decoded)",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.github.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "repo": {
          "type": "string",
          "description": "owner/repo"
        },
        "path": {
          "type": "string",
          "description": "File path within repo, e.g. 'README.md'"
        },
        "ref": {
          "type": "string",
          "description": "Branch/tag/commit (default default branch)"
        }
      },
      "required": [
        "repo",
        "path"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "path": {
          "type": "string"
        },
        "content": {
          "type": "string"
        },
        "encoding": {
          "type": "string"
        }
      }
    },
    "markdownDoc": "# read_github_file\n\nRead a file's content from a GitHub repo (branch aware, base64 decoded)\n\n### Permissions\n\nRequires `connector.github.read`.\n"
  },
  {
    "id": "tool-create-github-pull-request",
    "name": "create_github_pull_request",
    "category": "tools",
    "tags": [
      "Connector Write",
      "First Party"
    ],
    "description": "Create a GitHub pull request (approval-gated)",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.github.write",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "repo": {
          "type": "string",
          "description": "owner/repo"
        },
        "title": {
          "type": "string"
        },
        "body": {
          "type": "string"
        },
        "head": {
          "type": "string",
          "description": "Source branch"
        },
        "base": {
          "type": "string",
          "description": "Target branch (default main)"
        },
        "draft": {
          "type": "boolean",
          "default": true
        }
      },
      "required": [
        "repo",
        "title",
        "head"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "pr_id": {
          "type": "string"
        },
        "url": {
          "type": "string"
        }
      }
    },
    "markdownDoc": "# create_github_pull_request\n\nCreate a GitHub pull request (approval-gated)\n\n### Permissions\n\nRequires `connector.github.write`.\n"
  },
  {
    "id": "tool-send-slack-message",
    "name": "send_slack_message",
    "category": "tools",
    "tags": [
      "Connector Write",
      "First Party"
    ],
    "description": "Send Slack alerts and notifications to workspaces",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.slack.write",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "channel": {
          "type": "string"
        },
        "text": {
          "type": "string"
        },
        "blocks": {
          "type": "array",
          "items": {
            "type": "object"
          }
        }
      },
      "required": [
        "channel",
        "text"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "ts": {
          "type": "string"
        },
        "ok": {
          "type": "boolean"
        }
      }
    },
    "markdownDoc": "# send_slack_message\n\nSend Slack alerts and notifications to workspaces\n\n### Permissions\n\nRequires `connector.slack.write`.\n"
  },
  {
    "id": "tool-sync-notion-pages",
    "name": "sync_notion_pages",
    "category": "tools",
    "tags": [
      "Connector Read",
      "First Party"
    ],
    "description": "Read and write Notion workspace databases",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.notion.read_write",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "database_id": {
          "type": "string"
        },
        "query": {
          "type": "string"
        },
        "page_id": {
          "type": "string"
        },
        "properties": {
          "type": "object"
        },
        "operation": {
          "type": "string",
          "enum": [
            "query",
            "create",
            "update"
          ],
          "default": "query"
        }
      },
      "required": [
        "database_id"
      ]
    },
    "outputSchema": {
      "type": "array"
    },
    "markdownDoc": "# sync_notion_pages\n\nRead and write Notion workspace databases\n\n### Permissions\n\nRequires `connector.notion.read_write`.\n"
  },
  {
    "id": "tool-execute-code-sandbox",
    "name": "execute_code_sandbox",
    "category": "tools",
    "tags": [
      "System",
      "First Party"
    ],
    "description": "Approval-gated Python/JavaScript execution for coding problems (same-host subprocess with pattern filter + timeout + tmp cwd; NOT an OS sandbox \u2014 treat output as untrusted)",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "system.sandbox_exec",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "code": {
          "type": "string"
        },
        "language": {
          "type": "string",
          "enum": [
            "python",
            "javascript"
          ],
          "default": "python"
        },
        "input_data": {
          "type": "string"
        },
        "timeout": {
          "type": "integer",
          "default": 5
        }
      },
      "required": [
        "code"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "stdout": {
          "type": "string"
        },
        "stderr": {
          "type": "string"
        },
        "exit_code": {
          "type": "integer"
        }
      }
    },
    "markdownDoc": "# execute_code_sandbox\n\nApproval-gated Python/JavaScript execution for coding problems (same-host subprocess with pattern filter + timeout + tmp cwd; NOT an OS sandbox \u2014 treat output as untrusted)\n\n### Permissions\n\nRequires `system.sandbox_exec`.\n"
  },
  {
    "id": "tool-query-notebooklm",
    "name": "query_notebooklm",
    "category": "tools",
    "tags": [
      "Connector Read",
      "First Party"
    ],
    "description": "Query NotebookLM / Gemini Notebook (defaulting to the PIOS Blueprint) for grounded answers, citations, and architectural insights.",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "prompt": {
          "type": "string",
          "description": "The question or research query"
        },
        "notebook_id": {
          "type": "string",
          "description": "Optional Notebook ID (defaults to PIOS Blueprint 610611eb-a7df-4315-b717-c7398df55441)"
        }
      },
      "required": [
        "prompt"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "success": {
          "type": "boolean"
        },
        "answer": {
          "type": "string"
        },
        "citations": {
          "type": "array",
          "items": {
            "type": "object"
          }
        },
        "notebook_id": {
          "type": "string"
        }
      }
    },
    "markdownDoc": "# query_notebooklm\n\nQuery NotebookLM / Gemini Notebook (defaulting to the PIOS Blueprint) for grounded answers, citations, and architectural insights.\n\n### Permissions\n\nRequires `connector.read`.\n"
  },
  {
    "id": "tool-spawn-sub-agents",
    "name": "spawn_sub_agents",
    "category": "tools",
    "tags": [
      "System",
      "Core Trusted"
    ],
    "description": "Spawn one or more specialist sub-agents in parallel to execute subtasks concurrently. Available specialist agents: organization, memory, resume, ats, job_search, application, gmail, scheduler, research, career, coding, analytics, recommendation.",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "agent.spawn",
    "trustClass": "core_trusted",
    "inputSchema": {
      "type": "object",
      "properties": {
        "tasks": {
          "type": "array",
          "description": "List of sub-agent task definitions to execute in parallel.",
          "items": {
            "type": "object",
            "properties": {
              "agent_name": {
                "type": "string",
                "description": "Target agent name"
              },
              "instruction": {
                "type": "string",
                "description": "Clear instruction for the sub-agent"
              },
              "context": {
                "type": "object",
                "description": "Optional prior step outputs or structured parameters"
              }
            },
            "required": [
              "agent_name",
              "instruction"
            ]
          }
        }
      },
      "required": [
        "tasks"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "status": {
          "type": "string"
        },
        "results": {
          "type": "array",
          "items": {
            "type": "object"
          }
        },
        "aggregated_summary": {
          "type": "string"
        }
      }
    },
    "markdownDoc": "# spawn_sub_agents\n\nSpawn one or more specialist sub-agents in parallel to execute subtasks concurrently. Available specialist agents: organization, memory, resume, ats, job_search, application, gmail, scheduler, research, career, coding, analytics, recommendation.\n\n### Permissions\n\nRequires `agent.spawn`.\n"
  },
  {
    "id": "tool-delegate-to-sub-agent",
    "name": "delegate_to_sub_agent",
    "category": "tools",
    "tags": [
      "System",
      "Core Trusted"
    ],
    "description": "Delegate a focused subtask to a single specialist agent and wait for its structured response.",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "agent.spawn",
    "trustClass": "core_trusted",
    "inputSchema": {
      "type": "object",
      "properties": {
        "agent_name": {
          "type": "string",
          "description": "Target specialist agent name"
        },
        "instruction": {
          "type": "string",
          "description": "Instruction for the sub-agent"
        },
        "context": {
          "type": "object",
          "description": "Optional context dictionary"
        }
      },
      "required": [
        "agent_name",
        "instruction"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "status": {
          "type": "string"
        },
        "result": {
          "type": "object"
        }
      }
    },
    "markdownDoc": "# delegate_to_sub_agent\n\nDelegate a focused subtask to a single specialist agent and wait for its structured response.\n\n### Permissions\n\nRequires `agent.spawn`.\n"
  },
  {
    "id": "tool-download-file",
    "name": "download_file",
    "category": "tools",
    "tags": [
      "Connector Read",
      "First Party"
    ],
    "description": "Download a Google Drive file by file ID (binary content; Google Docs auto-exported as PDF)",
    "enabled": true,
    "source": "built-in",
    "usageCount": 0,
    "lastUsedAt": null,
    "isSeed": true,
    "requiredScope": "connector.drive.read",
    "trustClass": "first_party",
    "inputSchema": {
      "type": "object",
      "properties": {
        "file_id": {
          "type": "string",
          "description": "Drive file ID"
        },
        "mime_type": {
          "type": "string",
          "description": "Export MIME for Google Docs (default application/pdf)"
        }
      },
      "required": [
        "file_id"
      ]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "file_id": {
          "type": "string"
        },
        "name": {
          "type": "string"
        },
        "size_bytes": {
          "type": "integer"
        },
        "content_base64": {
          "type": "string"
        }
      }
    },
    "markdownDoc": "# download_file\n\nDownload a Google Drive file by file ID (binary content; Google Docs auto-exported as PDF)\n\n### Permissions\n\nRequires `connector.drive.read`.\n"
  }
];
