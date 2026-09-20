/**
 * Vaeloom Career Presentation Components.
 * Reusable vanilla/framework-agnostic UI presentation widgets for:
 * 1. ATS Score Gauge (SVG circular gauge with colored tiers)
 * 2. Resume Bullet Diff Card (highlighting injected keywords & metrics)
 * 3. Human-in-the-Loop Approval Drawer (for mutating tool permissions)
 * 4. Salary Percentile Band Chart (P25, Median, P75, P90 vs current offer)
 */

/**
 * Renders an animated SVG circular ATS match score gauge.
 * @param {number} score - ATS match percentage (0 - 100).
 * @param {string|HTMLElement} container - Target container element or ID.
 */
export function renderATSScoreGauge(score, container) {
  const el = typeof container === 'string' ? document.getElementById(container) : container;
  if (!el) return;

  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  let color = '#ef4444'; // Red (<60)
  let status = 'Significant Gap';
  if (clampedScore >= 80) {
    color = '#10b981'; // Green (>=80)
    status = 'Ready for Application';
  } else if (clampedScore >= 60) {
    color = '#f59e0b'; // Amber (60-79)
    status = 'Tailoring Recommended';
  }

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedScore / 100) * circumference;

  el.innerHTML = `
    <div style="display: flex; align-items: center; gap: 16px; padding: 16px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; font-family: -apple-system, sans-serif;">
      <div style="position: relative; width: 100px; height: 100px;">
        <svg width="100" height="100" viewBox="0 0 100 100" style="transform: rotate(-90deg);">
          <circle cx="50" cy="50" r="${radius}" stroke="#f1f5f9" stroke-width="8" fill="transparent" />
          <circle cx="50" cy="50" r="${radius}" stroke="${color}" stroke-width="8" fill="transparent"
            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round"
            style="transition: stroke-dashoffset 0.8s ease;" />
        </svg>
        <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <span style="font-size: 22px; font-weight: 700; color: #0f172a;">${clampedScore}%</span>
          <span style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 600;">ATS</span>
        </div>
      </div>
      <div>
        <div style="font-size: 14px; font-weight: 600; color: #0f172a;">Match Assessment</div>
        <div style="font-size: 13px; color: ${color}; font-weight: 500; margin-top: 2px;">${status}</div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Evaluated via Vaeloom Semantic ATS Kernel</div>
      </div>
    </div>
  `;
}

/**
 * Renders a side-by-side or stacked Resume Bullet Diff Viewer.
 * @param {string} original - Pre-tailored bullet text.
 * @param {string} tailored - AI-optimized bullet text with enhanced metrics and keywords.
 * @param {string|HTMLElement} container - Target element or ID.
 */
export function renderResumeDiffCard(original, tailored, container) {
  const el = typeof container === 'string' ? document.getElementById(container) : container;
  if (!el) return;

  el.innerHTML = `
    <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff; font-family: -apple-system, sans-serif;">
      <div style="padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 13px; font-weight: 600; color: #334155;">Resume Bullet Optimization</span>
        <span style="font-size: 11px; background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 999px; font-weight: 600;">ATS Tailored</span>
      </div>
      <div style="padding: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div style="background: #fff1f2; border: 1px solid #ffe4e6; border-radius: 8px; padding: 12px;">
          <div style="font-size: 11px; font-weight: 700; color: #be123c; margin-bottom: 6px; text-transform: uppercase;">Original Profile</div>
          <div style="font-size: 13px; color: #881337; line-height: 1.4;">${original}</div>
        </div>
        <div style="background: #f0fdf4; border: 1px solid #dcfce7; border-radius: 8px; padding: 12px;">
          <div style="font-size: 11px; font-weight: 700; color: #15803d; margin-bottom: 6px; text-transform: uppercase;">Tailored for Opportunity</div>
          <div style="font-size: 13px; color: #14532d; line-height: 1.4;">${tailored}</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders a Human-in-the-Loop Approval Drawer for mutating agent actions.
 * @param {object} request - ApprovalRequest payload { id, tool_name, parameters, reason }.
 * @param {Function} onApprove - Callback when user clicks Approve.
 * @param {Function} onReject - Callback when user clicks Reject.
 * @param {string|HTMLElement} container - Target container.
 */
export function renderApprovalDrawer(request, onApprove, onReject, container) {
  const el = typeof container === 'string' ? document.getElementById(container) : container;
  if (!el) return;

  const btnApproveId = `btn_appr_${request.id || 'action'}`;
  const btnRejectId = `btn_rej_${request.id || 'action'}`;

  el.innerHTML = `
    <div style="border: 2px solid #f59e0b; border-radius: 12px; background: #fffbeb; padding: 16px; font-family: -apple-system, sans-serif;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span style="font-size: 18px;">⚠️</span>
        <span style="font-size: 14px; font-weight: 700; color: #92400e;">Action Approval Required</span>
      </div>
      <p style="font-size: 13px; color: #78350f; margin: 0 0 12px 0;">
        The agent requested to execute mutating tool <code>${request.tool_name || 'mutating_action'}</code>.
        Review parameters before granting execution.
      </p>
      <pre style="background: #ffffff; border: 1px solid #fde68a; border-radius: 6px; padding: 8px; font-size: 12px; color: #1e293b; overflow-x: auto;">${JSON.stringify(request.parameters || {}, null, 2)}</pre>
      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px;">
        <button id="${btnRejectId}" style="background: #ffffff; border: 1px solid #cbd5e1; padding: 6px 14px; border-radius: 6px; font-size: 13px; cursor: pointer; color: #475569;">Reject</button>
        <button id="${btnApproveId}" style="background: #d97706; border: none; color: #ffffff; padding: 6px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;">Approve Execution</button>
      </div>
    </div>
  `;

  document
    .getElementById(btnApproveId)
    ?.addEventListener('click', () => onApprove && onApprove(request));
  document
    .getElementById(btnRejectId)
    ?.addEventListener('click', () => onReject && onReject(request));
}

/**
 * Renders a horizontal salary percentile compensation bar.
 * @param {object} benchmark - { p25, median, p75, p90 }.
 * @param {number} currentOffer - Total compensation offer amount.
 * @param {string|HTMLElement} container - Target container element.
 */
export function renderSalaryBandChart(benchmark, currentOffer, container) {
  const el = typeof container === 'string' ? document.getElementById(container) : container;
  if (!el) return;

  const minVal = benchmark.p25 * 0.85;
  const maxVal = benchmark.p90 * 1.15;
  const range = maxVal - minVal;

  const calcPct = (val) => Math.max(0, Math.min(100, ((val - minVal) / range) * 100));

  const p25Pct = calcPct(benchmark.p25);
  const medPct = calcPct(benchmark.median);
  const p75Pct = calcPct(benchmark.p75);
  const p90Pct = calcPct(benchmark.p90);
  const offerPct = calcPct(currentOffer);

  el.innerHTML = `
    <div style="padding: 16px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; font-family: -apple-system, sans-serif;">
      <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">Market Compensation Benchmark</div>
      <div style="font-size: 12px; color: #64748b; margin-bottom: 24px;">Comparing candidate offer vs industry percentile distributions</div>
      
      <div style="position: relative; height: 16px; background: #e2e8f0; border-radius: 8px; margin: 0 12px 36px 12px;">
        <!-- P25 to P75 range highlight -->
        <div style="position: absolute; left: ${p25Pct}%; width: ${p75Pct - p25Pct}%; height: 100%; background: #93c5fd; border-radius: 4px;"></div>
        <!-- Median marker -->
        <div style="position: absolute; left: ${medPct}%; top: -4px; bottom: -4px; width: 3px; background: #1d4ed8;" title="Median: $${benchmark.median.toLocaleString()}"></div>
        <!-- Current Offer marker -->
        <div style="position: absolute; left: ${offerPct}%; top: -10px; width: 14px; height: 14px; margin-left: -7px; border-radius: 50%; background: #10b981; border: 3px solid #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.2);" title="Offer: $${currentOffer.toLocaleString()}"></div>
        <div style="position: absolute; left: ${offerPct}%; top: 22px; transform: translateX(-50%); font-size: 11px; font-weight: 700; color: #047857;">Offer: $${currentOffer.toLocaleString()}</div>
      </div>

      <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 8px;">
        <span>P25: $${benchmark.p25.toLocaleString()}</span>
        <span>Median: $${benchmark.median.toLocaleString()}</span>
        <span>P75: $${benchmark.p75.toLocaleString()}</span>
        <span>P90: $${benchmark.p90.toLocaleString()}</span>
      </div>
    </div>
  `;
}
