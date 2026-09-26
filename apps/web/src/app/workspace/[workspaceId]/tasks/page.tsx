'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Card,
  Badge,
  Button,
  StatCard,
  CheckSquareIcon,
  ClockIcon,
  PlayIcon,
  AlertTriangleIcon,
  ShieldIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckIcon,
  RefreshCwIcon,
  UsersIcon,
  EmptyState,
} from '@vaeloom/ui-kit';
import { DEMO_AUTONOMOUS_TASKS } from '@/lib/fixtures/tasks';
import type { AutonomousTask, ExecutionSubtask } from '@/lib/fixtures/tasks';

export default function TasksPage() {
  const params = useParams();
  const workspaceId = typeof params?.['workspaceId'] === 'string' ? params['workspaceId'] : '';

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({
    'task-102': true, // Expand active running by default
  });

  const toggleExpand = (taskId: string) => {
    setExpandedTasks((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const tasks = DEMO_AUTONOMOUS_TASKS;

  const filteredTasks =
    statusFilter === 'ALL' ? tasks : tasks.filter((t) => t.status === statusFilter);

  const runningCount = tasks.filter((t) => t.status === 'RUNNING').length;
  const pendingApprovalCount = tasks.filter((t) => t.status === 'PENDING_APPROVAL').length;
  const completedCount = tasks.filter((t) => t.status === 'COMPLETED').length;

  const getStatusBadge = (status: AutonomousTask['status']) => {
    switch (status) {
      case 'RUNNING':
        return (
          <Badge variant="primary" size="sm">
            RUNNING
          </Badge>
        );
      case 'COMPLETED':
        return (
          <Badge variant="success" size="sm">
            COMPLETED
          </Badge>
        );
      case 'PENDING_APPROVAL':
        return (
          <Badge variant="warning" size="sm">
            APPROVAL REQUIRED
          </Badge>
        );
      case 'FAILED':
        return (
          <Badge variant="error" size="sm">
            FAILED
          </Badge>
        );
      default:
        return (
          <Badge variant="default" size="sm">
            {status}
          </Badge>
        );
    }
  };

  const getSubtaskStatusIcon = (status: ExecutionSubtask['status']) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckIcon size={14} className="text-success" />;
      case 'RUNNING':
        return <RefreshCwIcon size={14} className="text-action animate-spin" />;
      case 'APPROVAL_REQUIRED':
        return <ShieldIcon size={14} className="text-warning" />;
      case 'FAILED':
        return <AlertTriangleIcon size={14} className="text-error" />;
      default:
        return <ClockIcon size={14} className="text-text-muted" />;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
              Autonomous Tasks & Workflow DAGs
            </h1>
            <Badge variant="warning" size="sm">
              DEMO TELEMETRY
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-text-secondary">
            Multi-agent execution graph, step-level traces, and human-in-the-loop decision
            checkpoints.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href={`/workspace/${workspaceId}/approvals`}>
            <Button variant={pendingApprovalCount > 0 ? 'primary' : 'outline'} size="sm">
              <span className="flex items-center gap-1.5">
                <ShieldIcon size={14} /> Approvals Center{' '}
                {pendingApprovalCount > 0 && `(${pendingApprovalCount})`}
              </span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Execution Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Running DAGs"
          value={runningCount}
          icon={<PlayIcon size={20} />}
          caption="Autonomous agent execution loops"
        />
        <StatCard
          label="Pending Approvals"
          value={pendingApprovalCount}
          icon={<ShieldIcon size={20} />}
          caption="Awaiting HITL user consent"
        />
        <StatCard
          label="Completed Today"
          value={completedCount}
          icon={<CheckSquareIcon size={20} />}
          caption="Successfully finished tasks"
        />
        <StatCard
          label="Avg Workflow Time"
          value="42.8s"
          icon={<ClockIcon size={20} />}
          caption="Across 18 multi-agent tasks"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 pb-1">
        {['ALL', 'RUNNING', 'PENDING_APPROVAL', 'COMPLETED', 'FAILED'].map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              statusFilter === st
                ? 'bg-action text-white'
                : 'bg-surface-200 text-text-secondary hover:text-text'
            }`}
          >
            {st === 'ALL' ? 'All Executions' : st.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title="No workflow executions found"
            description="There are currently no tasks matching the selected execution state filter."
            action={{
              label: 'Reset Filter',
              onClick: () => setStatusFilter('ALL'),
            }}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredTasks.map((task: AutonomousTask) => {
            const isExpanded = !!expandedTasks[task.id];

            return (
              <Card key={task.id} className="p-5 space-y-4 border-border-strong transition-all">
                {/* Task Header */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-2xs px-2 py-0.5 rounded bg-surface-200 text-text-muted">
                        {task.workflowId}
                      </span>
                      {getStatusBadge(task.status)}
                      <Badge variant={task.priority === 'CRITICAL' ? 'error' : 'default'} size="sm">
                        {task.priority}
                      </Badge>
                      <span className="text-2xs text-text-muted font-mono">
                        Initiator: {task.initiator}
                      </span>
                    </div>

                    <h2 className="text-base font-bold text-text pt-0.5">{task.title}</h2>
                    <p className="text-xs text-text-secondary">{task.description}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {task.status === 'PENDING_APPROVAL' && (
                      <Link href={`/workspace/${workspaceId}/approvals`}>
                        <Button variant="primary" size="sm">
                          <span className="flex items-center gap-1.5">
                            <ShieldIcon size={14} /> Review Gate
                          </span>
                        </Button>
                      </Link>
                    )}
                    <Button variant="outline" size="sm" onClick={() => toggleExpand(task.id)}>
                      <span className="flex items-center gap-1.5">
                        {isExpanded ? 'Hide Steps' : `View Steps (${task.subtasks.length})`}
                        {isExpanded ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
                      </span>
                    </Button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-2xs text-text-secondary">
                    <span className="flex items-center gap-1 font-mono">
                      <UsersIcon size={12} /> Lead:{' '}
                      <strong className="text-text">{task.assignedAgent}</strong>
                    </span>
                    <span className="font-mono font-semibold text-text">
                      {task.progressPercentage}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-200 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        task.status === 'COMPLETED'
                          ? 'bg-success'
                          : task.status === 'FAILED'
                            ? 'bg-error'
                            : 'bg-action'
                      }`}
                      style={{ width: `${task.progressPercentage}%` }}
                    />
                  </div>
                </div>

                {/* Expanded Subtask DAG */}
                {isExpanded && (
                  <div className="pt-3 border-t border-border-subtle space-y-2.5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                      Execution Step DAG ({task.subtasks.length} Subtasks)
                    </h3>

                    <div className="space-y-2">
                      {task.subtasks.map((st, idx) => (
                        <div
                          key={st.id}
                          className="p-3 rounded-lg bg-surface-200/50 border border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="p-1 rounded bg-surface shrink-0 mt-0.5">
                              {getSubtaskStatusIcon(st.status)}
                            </span>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-2xs text-text-muted">
                                  #{idx + 1}
                                </span>
                                <span className="font-medium text-text">{st.title}</span>
                              </div>
                              {st.outputSummary && (
                                <p className="text-2xs text-text-secondary font-mono">
                                  Output: {st.outputSummary}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto text-2xs font-mono text-text-muted">
                            <span className="px-1.5 py-0.5 rounded bg-surface border border-border-subtle text-text">
                              {st.agent}
                            </span>
                            {st.durationMs && <span>{(st.durationMs / 1000).toFixed(1)}s</span>}
                            <Badge
                              variant={
                                st.status === 'COMPLETED'
                                  ? 'success'
                                  : st.status === 'RUNNING'
                                    ? 'primary'
                                    : st.status === 'APPROVAL_REQUIRED'
                                      ? 'warning'
                                      : 'default'
                              }
                              size="sm"
                            >
                              {st.status.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
