
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  passwordHash: 'passwordHash',
  displayName: 'displayName',
  avatarUrl: 'avatarUrl',
  authProvider: 'authProvider',
  status: 'status',
  preferences: 'preferences',
  tenantId: 'tenantId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AuthSessionScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  provider: 'provider',
  status: 'status',
  token: 'token',
  refreshToken: 'refreshToken',
  expiresAt: 'expiresAt',
  lastActivity: 'lastActivity',
  deviceInfo: 'deviceInfo',
  ipAddress: 'ipAddress',
  createdAt: 'createdAt'
};

exports.Prisma.ApiKeyScalarFieldEnum = {
  id: 'id',
  name: 'name',
  keyPrefix: 'keyPrefix',
  keyHash: 'keyHash',
  permissions: 'permissions',
  tenantId: 'tenantId',
  userId: 'userId',
  expiresAt: 'expiresAt',
  lastUsed: 'lastUsed',
  enabled: 'enabled',
  createdAt: 'createdAt'
};

exports.Prisma.TenantScalarFieldEnum = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  domain: 'domain',
  status: 'status',
  isolation: 'isolation',
  plan: 'plan',
  settings: 'settings',
  limits: 'limits',
  features: 'features',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.WorkspaceScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  name: 'name',
  description: 'description',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.WorkspaceUserScalarFieldEnum = {
  id: 'id',
  workspaceId: 'workspaceId',
  userId: 'userId',
  role: 'role',
  joinedAt: 'joinedAt'
};

exports.Prisma.ConnectorScalarFieldEnum = {
  id: 'id',
  workspaceId: 'workspaceId',
  type: 'type',
  scopes: 'scopes',
  status: 'status',
  tokenRef: 'tokenRef',
  lastSyncedAt: 'lastSyncedAt',
  config: 'config',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DocumentScalarFieldEnum = {
  id: 'id',
  workspaceId: 'workspaceId',
  sourceConnectorId: 'sourceConnectorId',
  path: 'path',
  type: 'type',
  rawStorageKey: 'rawStorageKey',
  summary: 'summary',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DocumentVersionScalarFieldEnum = {
  id: 'id',
  documentId: 'documentId',
  versionNumber: 'versionNumber',
  storageKey: 'storageKey',
  supersededBy: 'supersededBy',
  checksum: 'checksum',
  sizeBytes: 'sizeBytes',
  createdAt: 'createdAt'
};

exports.Prisma.MemoryRecordScalarFieldEnum = {
  id: 'id',
  workspaceId: 'workspaceId',
  type: 'type',
  content: 'content',
  confidence: 'confidence',
  importance: 'importance',
  freshnessAt: 'freshnessAt',
  sourceDocumentId: 'sourceDocumentId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.EntityScalarFieldEnum = {
  id: 'id',
  workspaceId: 'workspaceId',
  type: 'type',
  canonicalName: 'canonicalName',
  aliases: 'aliases',
  embeddingId: 'embeddingId',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RelationshipScalarFieldEnum = {
  id: 'id',
  workspaceId: 'workspaceId',
  fromEntityId: 'fromEntityId',
  toEntityId: 'toEntityId',
  relationType: 'relationType',
  confidence: 'confidence',
  sourceMemoryId: 'sourceMemoryId',
  metadata: 'metadata',
  createdAt: 'createdAt'
};

exports.Prisma.EmbeddingScalarFieldEnum = {
  id: 'id',
  workspaceId: 'workspaceId',
  sourceType: 'sourceType',
  sourceId: 'sourceId',
  modelVersion: 'modelVersion',
  createdAt: 'createdAt'
};

exports.Prisma.MemoryScalarFieldEnum = {
  id: 'id',
  type: 'type',
  status: 'status',
  title: 'title',
  summary: 'summary',
  content: 'content',
  contentHash: 'contentHash',
  size: 'size',
  metadata: 'metadata',
  tags: 'tags',
  tenantId: 'tenantId',
  userId: 'userId',
  workspaceId: 'workspaceId',
  sourceType: 'sourceType',
  sourceUri: 'sourceUri',
  sourceLabel: 'sourceLabel',
  connectorId: 'connectorId',
  vectorId: 'vectorId',
  graphNodeId: 'graphNodeId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ResumeScalarFieldEnum = {
  id: 'id',
  workspaceId: 'workspaceId',
  variantType: 'variantType',
  content: 'content',
  version: 'version',
  generatedFromSnapshot: 'generatedFromSnapshot',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ApplicationScalarFieldEnum = {
  id: 'id',
  workspaceId: 'workspaceId',
  jobExternalId: 'jobExternalId',
  platform: 'platform',
  status: 'status',
  resumeVersionId: 'resumeVersionId',
  coverLetter: 'coverLetter',
  submittedAt: 'submittedAt',
  outcome: 'outcome',
  outcomeAt: 'outcomeAt',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ScheduleEventScalarFieldEnum = {
  id: 'id',
  workspaceId: 'workspaceId',
  source: 'source',
  title: 'title',
  description: 'description',
  date: 'date',
  endDate: 'endDate',
  type: 'type',
  conflictFlag: 'conflictFlag',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AgentActionScalarFieldEnum = {
  id: 'id',
  workspaceId: 'workspaceId',
  agentName: 'agentName',
  actionType: 'actionType',
  inputRef: 'inputRef',
  outputRef: 'outputRef',
  status: 'status',
  error: 'error',
  durationMs: 'durationMs',
  tokensUsed: 'tokensUsed',
  cost: 'cost',
  createdAt: 'createdAt'
};

exports.Prisma.PermissionScalarFieldEnum = {
  id: 'id',
  workspaceId: 'workspaceId',
  connectorId: 'connectorId',
  agentName: 'agentName',
  actionType: 'actionType',
  scope: 'scope',
  grantedAt: 'grantedAt',
  revokedAt: 'revokedAt'
};

exports.Prisma.AgentScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  category: 'category',
  status: 'status',
  version: 'version',
  config: 'config',
  capabilities: 'capabilities',
  permissions: 'permissions',
  workspaceId: 'workspaceId',
  tenantId: 'tenantId',
  userId: 'userId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AgentExecutionScalarFieldEnum = {
  id: 'id',
  agentId: 'agentId',
  status: 'status',
  input: 'input',
  output: 'output',
  error: 'error',
  tokensUsed: 'tokensUsed',
  cost: 'cost',
  duration: 'duration',
  startedAt: 'startedAt',
  completedAt: 'completedAt'
};

exports.Prisma.EventScalarFieldEnum = {
  id: 'id',
  type: 'type',
  source: 'source',
  category: 'category',
  status: 'status',
  priority: 'priority',
  correlationId: 'correlationId',
  causationId: 'causationId',
  payload: 'payload',
  metadata: 'metadata',
  tenantId: 'tenantId',
  userId: 'userId',
  retryCount: 'retryCount',
  maxRetries: 'maxRetries',
  createdAt: 'createdAt',
  publishedAt: 'publishedAt'
};

exports.Prisma.EventSubscriptionScalarFieldEnum = {
  id: 'id',
  eventType: 'eventType',
  handlerId: 'handlerId',
  handlerType: 'handlerType',
  config: 'config',
  filters: 'filters',
  enabled: 'enabled',
  createdAt: 'createdAt'
};

exports.Prisma.DeadLetterEventScalarFieldEnum = {
  id: 'id',
  originalEventId: 'originalEventId',
  error: 'error',
  errorCount: 'errorCount',
  lastErrorAt: 'lastErrorAt',
  payload: 'payload',
  createdAt: 'createdAt'
};

exports.Prisma.SubscriptionScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  userId: 'userId',
  plan: 'plan',
  status: 'status',
  currentPeriodStart: 'currentPeriodStart',
  currentPeriodEnd: 'currentPeriodEnd',
  cancelAtPeriodEnd: 'cancelAtPeriodEnd',
  stripeCustomerId: 'stripeCustomerId',
  stripeSubscriptionId: 'stripeSubscriptionId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.UsageRecordScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  userId: 'userId',
  metric: 'metric',
  value: 'value',
  timestamp: 'timestamp'
};

exports.Prisma.IntegrationScalarFieldEnum = {
  id: 'id',
  name: 'name',
  provider: 'provider',
  config: 'config',
  status: 'status',
  tenantId: 'tenantId',
  userId: 'userId',
  lastSyncAt: 'lastSyncAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.UserOrderByRelevanceFieldEnum = {
  id: 'id',
  email: 'email',
  passwordHash: 'passwordHash',
  displayName: 'displayName',
  avatarUrl: 'avatarUrl',
  authProvider: 'authProvider',
  tenantId: 'tenantId'
};

exports.Prisma.AuthSessionOrderByRelevanceFieldEnum = {
  id: 'id',
  userId: 'userId',
  provider: 'provider',
  token: 'token',
  refreshToken: 'refreshToken',
  ipAddress: 'ipAddress'
};

exports.Prisma.ApiKeyOrderByRelevanceFieldEnum = {
  id: 'id',
  name: 'name',
  keyPrefix: 'keyPrefix',
  keyHash: 'keyHash',
  tenantId: 'tenantId',
  userId: 'userId'
};

exports.Prisma.TenantOrderByRelevanceFieldEnum = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  domain: 'domain',
  isolation: 'isolation',
  plan: 'plan',
  features: 'features'
};

exports.Prisma.WorkspaceOrderByRelevanceFieldEnum = {
  id: 'id',
  userId: 'userId',
  name: 'name',
  description: 'description'
};

exports.Prisma.WorkspaceUserOrderByRelevanceFieldEnum = {
  id: 'id',
  workspaceId: 'workspaceId',
  userId: 'userId'
};

exports.Prisma.ConnectorOrderByRelevanceFieldEnum = {
  id: 'id',
  workspaceId: 'workspaceId',
  type: 'type',
  scopes: 'scopes',
  tokenRef: 'tokenRef'
};

exports.Prisma.DocumentOrderByRelevanceFieldEnum = {
  id: 'id',
  workspaceId: 'workspaceId',
  sourceConnectorId: 'sourceConnectorId',
  path: 'path',
  type: 'type',
  rawStorageKey: 'rawStorageKey',
  summary: 'summary'
};

exports.Prisma.DocumentVersionOrderByRelevanceFieldEnum = {
  id: 'id',
  documentId: 'documentId',
  storageKey: 'storageKey',
  supersededBy: 'supersededBy',
  checksum: 'checksum'
};

exports.Prisma.MemoryRecordOrderByRelevanceFieldEnum = {
  id: 'id',
  workspaceId: 'workspaceId',
  sourceDocumentId: 'sourceDocumentId'
};

exports.Prisma.EntityOrderByRelevanceFieldEnum = {
  id: 'id',
  workspaceId: 'workspaceId',
  type: 'type',
  canonicalName: 'canonicalName',
  aliases: 'aliases',
  embeddingId: 'embeddingId'
};

exports.Prisma.RelationshipOrderByRelevanceFieldEnum = {
  id: 'id',
  workspaceId: 'workspaceId',
  fromEntityId: 'fromEntityId',
  toEntityId: 'toEntityId',
  relationType: 'relationType',
  sourceMemoryId: 'sourceMemoryId'
};

exports.Prisma.EmbeddingOrderByRelevanceFieldEnum = {
  id: 'id',
  workspaceId: 'workspaceId',
  sourceType: 'sourceType',
  sourceId: 'sourceId',
  modelVersion: 'modelVersion'
};

exports.Prisma.MemoryOrderByRelevanceFieldEnum = {
  id: 'id',
  type: 'type',
  title: 'title',
  summary: 'summary',
  content: 'content',
  contentHash: 'contentHash',
  tags: 'tags',
  tenantId: 'tenantId',
  userId: 'userId',
  workspaceId: 'workspaceId',
  sourceType: 'sourceType',
  sourceUri: 'sourceUri',
  sourceLabel: 'sourceLabel',
  connectorId: 'connectorId',
  vectorId: 'vectorId',
  graphNodeId: 'graphNodeId'
};

exports.Prisma.ResumeOrderByRelevanceFieldEnum = {
  id: 'id',
  workspaceId: 'workspaceId',
  variantType: 'variantType',
  generatedFromSnapshot: 'generatedFromSnapshot'
};

exports.Prisma.ApplicationOrderByRelevanceFieldEnum = {
  id: 'id',
  workspaceId: 'workspaceId',
  jobExternalId: 'jobExternalId',
  platform: 'platform',
  resumeVersionId: 'resumeVersionId',
  coverLetter: 'coverLetter',
  outcome: 'outcome'
};

exports.Prisma.ScheduleEventOrderByRelevanceFieldEnum = {
  id: 'id',
  workspaceId: 'workspaceId',
  source: 'source',
  title: 'title',
  description: 'description',
  type: 'type'
};

exports.Prisma.AgentActionOrderByRelevanceFieldEnum = {
  id: 'id',
  workspaceId: 'workspaceId',
  agentName: 'agentName',
  actionType: 'actionType',
  inputRef: 'inputRef',
  outputRef: 'outputRef',
  error: 'error'
};

exports.Prisma.PermissionOrderByRelevanceFieldEnum = {
  id: 'id',
  workspaceId: 'workspaceId',
  connectorId: 'connectorId',
  agentName: 'agentName',
  actionType: 'actionType',
  scope: 'scope'
};

exports.Prisma.AgentOrderByRelevanceFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  category: 'category',
  version: 'version',
  capabilities: 'capabilities',
  workspaceId: 'workspaceId',
  tenantId: 'tenantId',
  userId: 'userId'
};

exports.Prisma.AgentExecutionOrderByRelevanceFieldEnum = {
  id: 'id',
  agentId: 'agentId',
  error: 'error'
};

exports.Prisma.EventOrderByRelevanceFieldEnum = {
  id: 'id',
  type: 'type',
  source: 'source',
  category: 'category',
  correlationId: 'correlationId',
  causationId: 'causationId',
  tenantId: 'tenantId',
  userId: 'userId'
};

exports.Prisma.EventSubscriptionOrderByRelevanceFieldEnum = {
  id: 'id',
  eventType: 'eventType',
  handlerId: 'handlerId',
  handlerType: 'handlerType'
};

exports.Prisma.DeadLetterEventOrderByRelevanceFieldEnum = {
  id: 'id',
  originalEventId: 'originalEventId',
  error: 'error'
};

exports.Prisma.SubscriptionOrderByRelevanceFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  userId: 'userId',
  plan: 'plan',
  status: 'status',
  stripeCustomerId: 'stripeCustomerId',
  stripeSubscriptionId: 'stripeSubscriptionId'
};

exports.Prisma.UsageRecordOrderByRelevanceFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  userId: 'userId',
  metric: 'metric'
};

exports.Prisma.IntegrationOrderByRelevanceFieldEnum = {
  id: 'id',
  name: 'name',
  provider: 'provider',
  status: 'status',
  tenantId: 'tenantId',
  userId: 'userId'
};
exports.UserStatus = exports.$Enums.UserStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
  DELETED: 'DELETED'
};

exports.SessionStatus = exports.$Enums.SessionStatus = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
  SUSPENDED: 'SUSPENDED'
};

exports.TenantStatus = exports.$Enums.TenantStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  TRIAL: 'TRIAL',
  EXPIRED: 'EXPIRED',
  DELETED: 'DELETED'
};

exports.WorkspaceRole = exports.$Enums.WorkspaceRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  VIEWER: 'VIEWER'
};

exports.ConnectorStatus = exports.$Enums.ConnectorStatus = {
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
  SYNCING: 'SYNCING',
  ERROR: 'ERROR',
  REVOKED: 'REVOKED'
};

exports.MemoryType = exports.$Enums.MemoryType = {
  profile: 'profile',
  document: 'document',
  career: 'career',
  episodic: 'episodic',
  preference: 'preference',
  working: 'working'
};

exports.MemoryStatus = exports.$Enums.MemoryStatus = {
  PROCESSING: 'PROCESSING',
  INDEXED: 'INDEXED',
  FAILED: 'FAILED',
  ARCHIVED: 'ARCHIVED',
  DELETED: 'DELETED'
};

exports.ApplicationStatus = exports.$Enums.ApplicationStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  REVIEWED: 'REVIEWED',
  INTERVIEW: 'INTERVIEW',
  OFFER: 'OFFER',
  REJECTED: 'REJECTED',
  ACCEPTED: 'ACCEPTED',
  WITHDRAWN: 'WITHDRAWN'
};

exports.AgentActionStatus = exports.$Enums.AgentActionStatus = {
  STARTED: 'STARTED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
};

exports.AgentStatus = exports.$Enums.AgentStatus = {
  IDLE: 'IDLE',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  ERROR: 'ERROR',
  DISABLED: 'DISABLED'
};

exports.ExecutionStatus = exports.$Enums.ExecutionStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  TIMEOUT: 'TIMEOUT'
};

exports.EventStatus = exports.$Enums.EventStatus = {
  PUBLISHED: 'PUBLISHED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  RETRYING: 'RETRYING'
};

exports.EventPriority = exports.$Enums.EventPriority = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  NORMAL: 'NORMAL',
  LOW: 'LOW'
};

exports.Prisma.ModelName = {
  User: 'User',
  AuthSession: 'AuthSession',
  ApiKey: 'ApiKey',
  Tenant: 'Tenant',
  Workspace: 'Workspace',
  WorkspaceUser: 'WorkspaceUser',
  Connector: 'Connector',
  Document: 'Document',
  DocumentVersion: 'DocumentVersion',
  MemoryRecord: 'MemoryRecord',
  Entity: 'Entity',
  Relationship: 'Relationship',
  Embedding: 'Embedding',
  Memory: 'Memory',
  Resume: 'Resume',
  Application: 'Application',
  ScheduleEvent: 'ScheduleEvent',
  AgentAction: 'AgentAction',
  Permission: 'Permission',
  Agent: 'Agent',
  AgentExecution: 'AgentExecution',
  Event: 'Event',
  EventSubscription: 'EventSubscription',
  DeadLetterEvent: 'DeadLetterEvent',
  Subscription: 'Subscription',
  UsageRecord: 'UsageRecord',
  Integration: 'Integration'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
