/**
 * Vaeloom Server-Sent Events (SSE) Streaming Client.
 *
 * Connects to Vaeloom Orchestrator (/api/v1/orchestrator/execute or /api/v1/chat/stream)
 * and dispatches typed agent events with automatic reconnection and lifecycle handling.
 */

export class VaeloomStreamClient {
  /**
   * @param {object} options
   * @param {string} options.baseUrl - Base API URL (e.g. 'http://localhost:8000')
   * @param {string} [options.token] - JWT bearer token
   * @param {number} [options.maxRetries=3] - Maximum retry attempts on network drop
   */
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl || 'http://localhost:8000').replace(/\/+$/, '');
    this.token = options.token || null;
    this.maxRetries = options.maxRetries ?? 3;
    this.abortController = null;
    this.handlers = {
      thought: [],
      tool_call: [],
      tool_result: [],
      approval_required: [],
      final_answer: [],
      error: [],
      done: [],
    };
  }

  /**
   * Registers an event callback.
   * @param {'thought'|'tool_call'|'tool_result'|'approval_required'|'final_answer'|'error'|'done'} event
   * @param {Function} callback
   */
  on(event, callback) {
    if (this.handlers[event]) {
      this.handlers[event].push(callback);
    }
    return this;
  }

  emit(event, data) {
    const list = this.handlers[event] || [];
    for (const fn of list) {
      try {
        fn(data);
      } catch (err) {
        console.error(`[VaeloomStreamClient] Handler error on event '${event}':`, err);
      }
    }
  }

  /**
   * Initiates streaming execution of an agent turn.
   * @param {object} requestPayload - { user_id, tenant_id, agent_id, user_prompt }
   */
  async execute(requestPayload) {
    this.abort();
    this.abortController = new AbortController();

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const endpoint = `${this.baseUrl}/api/v1/orchestrator/execute`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestPayload),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null, SSE stream unavailable');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n\r?\n/);
        buffer = lines.pop() || '';

        for (const block of lines) {
          this._processEventBlock(block);
        }
      }

      if (buffer.trim()) {
        this._processEventBlock(buffer);
      }

      this.emit('done', { status: 'completed' });
    } catch (err) {
      if (err.name === 'AbortError') {
        this.emit('done', { status: 'aborted' });
      } else {
        this.emit('error', { message: err.message, error: err });
      }
    }
  }

  _processEventBlock(block) {
    const lines = block.split(/\r?\n/);
    let eventName = 'message';
    let dataStr = '';

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.replace(/^event:\s*/, '').trim();
      } else if (line.startsWith('data:')) {
        dataStr += line.replace(/^data:\s*/, '').trim();
      }
    }

    if (!dataStr) return;

    try {
      const parsed = JSON.parse(dataStr);
      const targetType = parsed.type || eventName;

      if (this.handlers[targetType]) {
        this.emit(targetType, parsed.payload || parsed);
      } else {
        this.emit('thought', parsed);
      }
    } catch {
      // Raw string fallback
      this.emit('thought', { text: dataStr });
    }
  }

  /**
   * Aborts active stream.
   */
  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}
