/**
 * Authentic Tool Definitions Catalog for Vaeloom Capabilities
 * Matches Python backend schemas from `apps/api/src/api/tools/definitions.py`.
 */

export interface ToolParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  default?: string | number | boolean;
}

export interface ToolDefinitionItem {
  name: string;
  title: string;
  description: string;
  requiredScope: string;
  category:
    'memory_read' | 'memory_write' | 'connector_read' | 'connector_write' | 'system' | 'browser';
  trustClass: 'core_trusted' | 'first_party' | 'mcp.read' | 'mcp.workspace.write' | 'untrusted';
  approvalGated: boolean;
  parameters: ToolParameter[];
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  samplePayload: Record<string, unknown>;
}

export interface SuiteCatalog {
  suiteId: string;
  icon: string;
  description: string;
  tools: ToolDefinitionItem[];
}

export const TOOL_DEFINITIONS_CATALOG: Record<string, SuiteCatalog> = {
  'browser-automation': {
    suiteId: 'browser-automation',
    icon: 'globe',
    description:
      'Autonomous Playwright Chromium browser session runner with SSRF boundary guard and quota management.',
    tools: [
      {
        name: 'browse_job_page',
        title: 'Browse Job Page',
        description:
          'Navigates to a public job listing URL, extracts structured posting metadata, job description, requirements, and company info.',
        requiredScope: 'connector.browser.read',
        category: 'browser',
        trustClass: 'core_trusted',
        approvalGated: false,
        parameters: [
          {
            name: 'url',
            type: 'string',
            required: true,
            description: 'Target job board URL (HTTPS only, SSRF-guarded).',
          },
          {
            name: 'wait_for_selector',
            type: 'string',
            required: false,
            description: 'Optional CSS selector to wait for before extracting DOM.',
          },
          {
            name: 'timeout_ms',
            type: 'integer',
            required: false,
            description: 'Maximum navigation timeout in milliseconds.',
            default: 15000,
          },
        ],
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', format: 'uri' },
            wait_for_selector: { type: 'string' },
            timeout_ms: { type: 'integer', default: 15000 },
          },
          required: ['url'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            company: { type: 'string' },
            location: { type: 'string' },
            markdown_content: { type: 'string' },
            application_url: { type: 'string' },
          },
        },
        samplePayload: {
          url: 'https://boards.greenhouse.io/anthropic/jobs/4321098',
          timeout_ms: 15000,
        },
      },
      {
        name: 'scrape_company_insights',
        title: 'Scrape Company Insights',
        description:
          'Extracts company mission, recent engineering blog posts, tech stack markers, and press releases.',
        requiredScope: 'connector.browser.read',
        category: 'browser',
        trustClass: 'core_trusted',
        approvalGated: false,
        parameters: [
          {
            name: 'company_domain',
            type: 'string',
            required: true,
            description: 'Fully qualified company domain (e.g. stripe.com).',
          },
          {
            name: 'depth',
            type: 'integer',
            required: false,
            description: 'Crawl depth for link traversal (1-3).',
            default: 1,
          },
        ],
        inputSchema: {
          type: 'object',
          properties: {
            company_domain: { type: 'string' },
            depth: { type: 'integer', default: 1 },
          },
          required: ['company_domain'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            culture_summary: { type: 'string' },
            tech_stack: { type: 'array', items: { type: 'string' } },
            recent_initiatives: { type: 'array', items: { type: 'string' } },
          },
        },
        samplePayload: {
          company_domain: 'github.com',
          depth: 1,
        },
      },
      {
        name: 'verify_application_link',
        title: 'Verify Application Link',
        description:
          'Performs non-destructive HEAD and GET probes against application submission URLs to detect expired listings or dead links.',
        requiredScope: 'connector.browser.read',
        category: 'browser',
        trustClass: 'core_trusted',
        approvalGated: false,
        parameters: [
          {
            name: 'url',
            type: 'string',
            required: true,
            description: 'The candidate job application URL to verify.',
          },
        ],
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', format: 'uri' },
          },
          required: ['url'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            is_active: { type: 'boolean' },
            http_status: { type: 'integer' },
            verdict: { type: 'string', enum: ['active', 'expired', 'blocked_or_captcha', 'error'] },
          },
        },
        samplePayload: {
          url: 'https://jobs.lever.co/openai/senior-systems-engineer',
        },
      },
    ],
  },
  'memory-graph': {
    suiteId: 'memory-graph',
    icon: 'database',
    description:
      'Semantic vector retrieval, knowledge graph traversal, and episodic memory persistence engines.',
    tools: [
      {
        name: 'search_documents',
        title: 'Search Documents',
        description:
          'Vector similarity semantic search over indexed workspace documents, resumes, and conversation transcripts.',
        requiredScope: 'memory.read',
        category: 'memory_read',
        trustClass: 'first_party',
        approvalGated: false,
        parameters: [
          {
            name: 'query',
            type: 'string',
            required: true,
            description: 'Natural language search query or semantic keywords.',
          },
          {
            name: 'limit',
            type: 'integer',
            required: false,
            description: 'Maximum number of document fragments to retrieve.',
            default: 10,
          },
          {
            name: 'min_score',
            type: 'number',
            required: false,
            description: 'Cosine similarity score threshold (0.0 to 1.0).',
            default: 0.65,
          },
        ],
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            limit: { type: 'integer', default: 10 },
            min_score: { type: 'number', default: 0.65 },
          },
          required: ['query'],
        },
        outputSchema: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              content: { type: 'string' },
              score: { type: 'number' },
              metadata: { type: 'object' },
            },
          },
        },
        samplePayload: {
          query: 'Distributed systems experience with Kubernetes and Go',
          limit: 5,
          min_score: 0.7,
        },
      },
      {
        name: 'query_graph',
        title: 'Query Knowledge Graph',
        description:
          'Graph query traversal looking for entities, relations, projects, and work history connections.',
        requiredScope: 'memory.read',
        category: 'memory_read',
        trustClass: 'first_party',
        approvalGated: false,
        parameters: [
          {
            name: 'query',
            type: 'string',
            required: true,
            description: 'Entity or relationship keyword search.',
          },
          {
            name: 'entity_type',
            type: 'string',
            required: false,
            description: 'Filter by entity type (company, skill, person, role).',
            default: 'any',
          },
          {
            name: 'limit',
            type: 'integer',
            required: false,
            description: 'Maximum number of nodes to return.',
            default: 20,
          },
        ],
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            entity_type: { type: 'string', default: 'any' },
            limit: { type: 'integer', default: 20 },
          },
          required: ['query'],
        },
        outputSchema: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              label: { type: 'string' },
              type: { type: 'string' },
              neighbors: { type: 'array' },
            },
          },
        },
        samplePayload: {
          query: 'TypeScript',
          entity_type: 'skill',
          limit: 10,
        },
      },
      {
        name: 'create_entity',
        title: 'Create Graph Entity',
        description:
          'Creates a persistent entity in the workspace knowledge graph with structured properties and provenance tracking.',
        requiredScope: 'memory.write',
        category: 'memory_write',
        trustClass: 'first_party',
        approvalGated: false,
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Entity display name.' },
          {
            name: 'entity_type',
            type: 'string',
            required: true,
            description: 'Category (e.g. project, company, certification).',
          },
          {
            name: 'properties',
            type: 'object',
            required: false,
            description: 'Key-value map of entity attributes.',
          },
        ],
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            entity_type: { type: 'string' },
            properties: { type: 'object' },
          },
          required: ['name', 'entity_type'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            created_at: { type: 'string' },
          },
        },
        samplePayload: {
          name: 'PostgreSQL HNSW Extension',
          entity_type: 'technology',
          properties: { version: '16.2', status: 'production' },
        },
      },
    ],
  },
  'web-search': {
    suiteId: 'web-search',
    icon: 'search',
    description:
      'Live web search indexing, real-time news retrieval, and authenticated webpage content extraction.',
    tools: [
      {
        name: 'web_search',
        title: 'Web Search',
        description:
          'Performs live multi-engine web search queries with relevance reranking and domain filtering.',
        requiredScope: 'connector.web.search',
        category: 'connector_read',
        trustClass: 'first_party',
        approvalGated: false,
        parameters: [
          {
            name: 'query',
            type: 'string',
            required: true,
            description: 'Search keywords or question.',
          },
          {
            name: 'max_results',
            type: 'integer',
            required: false,
            description: 'Number of search hits to return.',
            default: 5,
          },
          {
            name: 'domain_filter',
            type: 'string',
            required: false,
            description: 'Restrict search to specific domain (e.g. arxiv.org).',
          },
        ],
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            max_results: { type: 'integer', default: 5 },
            domain_filter: { type: 'string' },
          },
          required: ['query'],
        },
        outputSchema: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              url: { type: 'string' },
              snippet: { type: 'string' },
            },
          },
        },
        samplePayload: {
          query: 'Next.js 15 Server Actions best practices',
          max_results: 5,
        },
      },
      {
        name: 'fetch_webpage_content',
        title: 'Fetch Webpage Content',
        description:
          'Retrieves sanitized Markdown text from any public URL, stripping ad scripts and boilerplate navigation.',
        requiredScope: 'connector.web.read',
        category: 'connector_read',
        trustClass: 'first_party',
        approvalGated: false,
        parameters: [
          { name: 'url', type: 'string', required: true, description: 'Target website URL.' },
          {
            name: 'extract_tables',
            type: 'boolean',
            required: false,
            description: 'Convert HTML tables into Markdown syntax.',
            default: true,
          },
        ],
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', format: 'uri' },
            extract_tables: { type: 'boolean', default: true },
          },
          required: ['url'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            markdown: { type: 'string' },
            status: { type: 'integer' },
          },
        },
        samplePayload: {
          url: 'https://docs.github.com/en/rest',
          extract_tables: true,
        },
      },
    ],
  },
  'agent-bus': {
    suiteId: 'agent-bus',
    icon: 'network',
    description:
      'Agent-to-Agent (A2A) protocol bus for sub-delegation, parallel fan-out, and peer message passing.',
    tools: [
      {
        name: 'delegate_to_agent',
        title: 'Delegate to Agent',
        description:
          'Dispatches a sub-task to a specialized agent (e.g. JobSearchAgent, ApplicationAgent, ResumeAgent).',
        requiredScope: 'system.agent.dispatch',
        category: 'system',
        trustClass: 'first_party',
        approvalGated: false,
        parameters: [
          {
            name: 'target_agent',
            type: 'string',
            required: true,
            description: 'Name of the specialist agent archetype.',
          },
          {
            name: 'task_prompt',
            type: 'string',
            required: true,
            description: 'Detailed instruction context for the subagent.',
          },
          {
            name: 'timeout_seconds',
            type: 'integer',
            required: false,
            description: 'Execution timeout.',
            default: 60,
          },
        ],
        inputSchema: {
          type: 'object',
          properties: {
            target_agent: { type: 'string' },
            task_prompt: { type: 'string' },
            timeout_seconds: { type: 'integer', default: 60 },
          },
          required: ['target_agent', 'task_prompt'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            agent_response: { type: 'string' },
            tokens_used: { type: 'integer' },
          },
        },
        samplePayload: {
          target_agent: 'ats_optimizer',
          task_prompt:
            'Analyze resume bullet points against the staff software engineer job description.',
          timeout_seconds: 45,
        },
      },
      {
        name: 'broadcast_message',
        title: 'Broadcast Agent Message',
        description:
          'Publishes an event to the shared workspace council channel for collective multi-agent consensus.',
        requiredScope: 'system.agent.broadcast',
        category: 'system',
        trustClass: 'first_party',
        approvalGated: false,
        parameters: [
          {
            name: 'channel',
            type: 'string',
            required: true,
            description: 'Target topic channel (e.g. council, telemetry).',
          },
          { name: 'payload', type: 'object', required: true, description: 'JSON event body.' },
        ],
        inputSchema: {
          type: 'object',
          properties: {
            channel: { type: 'string' },
            payload: { type: 'object' },
          },
          required: ['channel', 'payload'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            acknowledged: { type: 'boolean' },
          },
        },
        samplePayload: {
          channel: 'council',
          payload: { event: 'review_ready', artifact_id: 'res_98765' },
        },
      },
    ],
  },
  'code-exec': {
    suiteId: 'code-exec',
    icon: 'terminal',
    description:
      'Sandboxed Python 3.12 and Bash script execution environment with isolated temporary file paths.',
    tools: [
      {
        name: 'eval_python',
        title: 'Evaluate Python',
        description:
          'Executes mathematical calculations, data formatting, or transformations inside an isolated subprocess.',
        requiredScope: 'system.execute',
        category: 'system',
        trustClass: 'first_party',
        approvalGated: true,
        parameters: [
          {
            name: 'code',
            type: 'string',
            required: true,
            description: 'Python code snippet to execute.',
          },
          {
            name: 'timeout_seconds',
            type: 'integer',
            required: false,
            description: 'Hard timeout in seconds.',
            default: 10,
          },
        ],
        inputSchema: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            timeout_seconds: { type: 'integer', default: 10 },
          },
          required: ['code'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            stdout: { type: 'string' },
            stderr: { type: 'string' },
            exit_code: { type: 'integer' },
          },
        },
        samplePayload: {
          code: 'import math\nprint(f"PI: {math.pi:.6f}")\nscores = [85, 92, 78, 96]\nprint(f"Mean: {sum(scores)/len(scores):.2f}")',
          timeout_seconds: 5,
        },
      },
    ],
  },
  'computer-use': {
    suiteId: 'computer-use',
    icon: 'monitor',
    description:
      'Direct OS desktop interaction, screen capture, mouse click positioning, and keyboard typing.',
    tools: [
      {
        name: 'take_screenshot',
        title: 'Take Screenshot',
        description:
          'Captures the current viewport or primary monitor screen buffer for visual perception models.',
        requiredScope: 'system.screen.read',
        category: 'system',
        trustClass: 'first_party',
        approvalGated: false,
        parameters: [
          {
            name: 'format',
            type: 'string',
            required: false,
            description: 'Image output format (png or jpeg).',
            default: 'png',
          },
        ],
        inputSchema: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['png', 'jpeg'], default: 'png' },
          },
        },
        outputSchema: {
          type: 'object',
          properties: {
            base64_image: { type: 'string' },
            width: { type: 'integer' },
            height: { type: 'integer' },
          },
        },
        samplePayload: {
          format: 'png',
        },
      },
      {
        name: 'cursor_click',
        title: 'Cursor Click',
        description:
          'Moves mouse cursor to target X, Y screen coordinates and dispatches click event.',
        requiredScope: 'system.input.write',
        category: 'system',
        trustClass: 'first_party',
        approvalGated: true,
        parameters: [
          {
            name: 'x',
            type: 'integer',
            required: true,
            description: 'Screen X coordinate in pixels.',
          },
          {
            name: 'y',
            type: 'integer',
            required: true,
            description: 'Screen Y coordinate in pixels.',
          },
          {
            name: 'button',
            type: 'string',
            required: false,
            description: 'Mouse button (left, right, middle).',
            default: 'left',
          },
        ],
        inputSchema: {
          type: 'object',
          properties: {
            x: { type: 'integer' },
            y: { type: 'integer' },
            button: { type: 'string', enum: ['left', 'right', 'middle'], default: 'left' },
          },
          required: ['x', 'y'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
        samplePayload: {
          x: 450,
          y: 320,
          button: 'left',
        },
      },
    ],
  },
  'file-operations': {
    suiteId: 'file-operations',
    icon: 'folder',
    description:
      'Sandboxed filesystem reads and writes scoped strictly within the active workspace root.',
    tools: [
      {
        name: 'read_workspace_file',
        title: 'Read Workspace File',
        description: 'Reads text file contents from the workspace repository or documents folder.',
        requiredScope: 'file.read',
        category: 'system',
        trustClass: 'first_party',
        approvalGated: false,
        parameters: [
          {
            name: 'file_path',
            type: 'string',
            required: true,
            description: 'Relative path within the workspace directory.',
          },
        ],
        inputSchema: {
          type: 'object',
          properties: {
            file_path: { type: 'string' },
          },
          required: ['file_path'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            content: { type: 'string' },
            size_bytes: { type: 'integer' },
          },
        },
        samplePayload: {
          file_path: 'resumes/senior_fullstack_2026.md',
        },
      },
      {
        name: 'write_workspace_file',
        title: 'Write Workspace File',
        description:
          'Saves or updates a text file within the workspace with path-traversal denial safeguards.',
        requiredScope: 'file.write',
        category: 'system',
        trustClass: 'first_party',
        approvalGated: true,
        parameters: [
          {
            name: 'file_path',
            type: 'string',
            required: true,
            description: 'Relative path within the workspace.',
          },
          { name: 'content', type: 'string', required: true, description: 'New file content.' },
        ],
        inputSchema: {
          type: 'object',
          properties: {
            file_path: { type: 'string' },
            content: { type: 'string' },
          },
          required: ['file_path', 'content'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            bytes_written: { type: 'integer' },
          },
        },
        samplePayload: {
          file_path: 'notes/job_search_plan.md',
          content:
            '# 2026 Q3 Search Goals\n- Target 5 Tier-1 AI startups\n- Focus on Distributed Systems',
        },
      },
    ],
  },
  'kanban-workflow': {
    suiteId: 'kanban-workflow',
    icon: 'kanban',
    description:
      'Project task tracking, card lifecycle transitions, and external Jira/Linear bidirectional sync.',
    tools: [
      {
        name: 'create_task_card',
        title: 'Create Task Card',
        description: 'Inserts a new work item into the workspace Kanban board.',
        requiredScope: 'workflow.kanban.write',
        category: 'connector_write',
        trustClass: 'first_party',
        approvalGated: false,
        parameters: [
          { name: 'title', type: 'string', required: true, description: 'Task title summary.' },
          {
            name: 'lane',
            type: 'string',
            required: true,
            description: 'Column lane (todo, in_progress, review, done).',
          },
          {
            name: 'priority',
            type: 'string',
            required: false,
            description: 'Task priority (low, medium, high, urgent).',
            default: 'medium',
          },
        ],
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            lane: { type: 'string', enum: ['todo', 'in_progress', 'review', 'done'] },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'urgent'],
              default: 'medium',
            },
          },
          required: ['title', 'lane'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            card_id: { type: 'string' },
          },
        },
        samplePayload: {
          title: 'Review Google Cloud Run deployment terraform manifest',
          lane: 'todo',
          priority: 'high',
        },
      },
    ],
  },
  'spotify-media': {
    suiteId: 'spotify-media',
    icon: 'music',
    description:
      'Authenticated Spotify Web API media control, playlist discovery, and track queueing.',
    tools: [
      {
        name: 'playback_state',
        title: 'Get Playback State',
        description:
          'Reads current active Spotify playback device, track title, artist, and playing progress.',
        requiredScope: 'connector.spotify.read',
        category: 'connector_read',
        trustClass: 'first_party',
        approvalGated: false,
        parameters: [],
        inputSchema: { type: 'object', properties: {} },
        outputSchema: {
          type: 'object',
          properties: {
            is_playing: { type: 'boolean' },
            track: { type: 'string' },
            artist: { type: 'string' },
          },
        },
        samplePayload: {},
      },
      {
        name: 'queue_track',
        title: 'Queue Spotify Track',
        description: 'Appends a Spotify URI to the current active playback queue.',
        requiredScope: 'connector.spotify.write',
        category: 'connector_write',
        trustClass: 'first_party',
        approvalGated: false,
        parameters: [
          {
            name: 'uri',
            type: 'string',
            required: true,
            description: 'Spotify track URI (e.g. spotify:track:4cOdK2wGLETKBW3PvgPWqT).',
          },
        ],
        inputSchema: {
          type: 'object',
          properties: {
            uri: { type: 'string' },
          },
          required: ['uri'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            queued: { type: 'boolean' },
          },
        },
        samplePayload: {
          uri: 'spotify:track:4cOdK2wGLETKBW3PvgPWqT',
        },
      },
    ],
  },
  'custom-workspace': {
    suiteId: 'custom-workspace',
    icon: 'wrench',
    description:
      'User-defined bespoke API and MCP bridged tools registered directly within this workspace.',
    tools: [
      {
        name: 'execute_custom_capability',
        title: 'Execute Custom Capability',
        description:
          'Executes a user-authored workspace capability or bridged MCP endpoint with sandbox parameters.',
        requiredScope: 'workspace.custom.execute',
        category: 'system',
        trustClass: 'mcp.workspace.write',
        approvalGated: true,
        parameters: [
          {
            name: 'capability_id',
            type: 'string',
            required: true,
            description: 'ID of the registered capability.',
          },
          {
            name: 'arguments',
            type: 'object',
            required: false,
            description: 'Key-value input map passed to the execution runtime.',
          },
        ],
        inputSchema: {
          type: 'object',
          properties: {
            capability_id: { type: 'string' },
            arguments: { type: 'object' },
          },
          required: ['capability_id'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            result: { type: 'object' },
          },
        },
        samplePayload: {
          capability_id: 'custom-pdf-extractor',
          arguments: { doc_id: 'res_12345' },
        },
      },
    ],
  },
};
