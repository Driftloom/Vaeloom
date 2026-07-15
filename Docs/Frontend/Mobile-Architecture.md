# Mobile Architecture

> **Purpose:** Define the React Native mobile companion app architecture for Meridian
> **Status:** 🆕 New
> **Owner:** Frontend Team
> **Last Updated:** 2026-07-13

## Overview

Meridian provides a React Native companion app for iOS and Android that serves as a mobile extension of the web application — not a full parity client. The companion is designed for on-the-go access to the most critical workflows: reviewing dashboards, managing workspaces, chatting with agents, receiving notifications, and quick document uploads.

The mobile app shares TypeScript types, GraphQL fragments, and core business logic with the web frontend through a shared monorepo package (`packages/shared`). Platform-specific UI is built using React Native components while reusing design tokens from the web design system.

## Architecture

```mermaid
graph TD
    classDef shared fill:#e3f2fd,stroke:#1565c0,color:#000
    classDef native fill:#e8f5e9,stroke:#2e7d32,color:#000
    classDef service fill:#fff3e0,stroke:#e65100,color:#000
    classDef storage fill:#f3e5f5,stroke:#6a1b9a,color:#000

    subgraph Monorepo["Shared Packages"]
        T["@meridian/types<br/>TypeScript types & interfaces"]
        G["@meridian/graphql<br/>Fragments & queries"]
        U["@meridian/utils<br/>Business logic, formatting"]
        D["@meridian/design-tokens<br/>Colors, spacing, typography"]
    end

    subgraph MobileApp["React Native App"]
        Nav["Navigation Layer<br/>React Navigation 7"]
        Screens["Screen Modules"]
        Comp["UI Components<br/>RN + Native"]
        Store["State<br/>Zustand + MMKV"]
        Offline["Offline Engine<br/>WatermelonDB"]
    end

    subgraph Screens["Screens"]
        S1["Dashboard<br/>Summary cards, activity"]
        S2["Workspace<br/>Documents, folders, search"]
        S3["Chat<br/>Agent conversations"]
        S4["Notifications<br/>Push + in-app"]
        S5["Quick Upload<br/>Camera, files, scanner"]
    end

    subgraph Services["Mobile Services"]
        API["API Client<br/>Apollo GraphQL"]
        Push["Push Notifications<br/>FCM / APNs"]
        Bio["Biometric Auth<br/>Face ID / Fingerprint"]
        Cache["Offline Cache<br/>WatermelonDB + SQLite"]
    end

    T --> Nav & Screens & Store
    G --> API
    U --> Store & Offline
    D --> Comp

    Screens --> Store
    Screens --> API
    Screens --> Offline
    Screens --> Push
    Screens --> Bio

    API --> Cache
    Offline --> Cache

    class T,G,U,D shared
    class Nav,Screens,Comp,Store,Offline native
    class API,Push,Bio,Cache service
```

## Screen Architecture

```mermaid
graph LR
    classDef screen fill:#e8f5e9,stroke:#2e7d32,color:#000
    classDef auth fill:#fff3e0,stroke:#e65100,color:#000
    classDef stack fill:#e3f2fd,stroke:#1565c0,color:#000

    Auth["Auth Flow<br/>Login / Signup"] --> Tabs["Main Tab Navigator"]
    
    subgraph Tabs["Bottom Tab Navigator"]
        Tab1["Dashboard"]
        Tab2["Workspace"]
        Tab3["Chat"]
        Tab4["Notifications"]
    end
    
    Tabs --> Tab1 & Tab2 & Tab3 & Tab4
    Tab1 --> D1["Today's Activity"]
    Tab1 --> D2["Pending Tasks"]
    Tab1 --> D3["Quick Stats"]
    Tab2 --> W1["Document List"]
    Tab2 --> W2["Folder Browser"]
    Tab2 --> W3["Search"]
    Tab3 --> C1["Conversation List"]
    Tab3 --> C2["Chat View"]
    Tab4 --> N1["Notification List"]

    QuickUpload["FAB: Quick Upload"] --> U1["Camera Capture"]
    QuickUpload --> U2["File Picker"]
    QuickUpload --> U3["Document Scanner"]

    class Auth auth
    class Tab1,Tab2,Tab3,Tab4 screen
    class D1,D2,D3,W1,W2,W3,C1,C2,N1,U1,U2,U3 stack
```

## Offline Mode

The companion app supports offline-first reads and optimistic updates:

```typescript
interface OfflineStrategy {
  reads: 'cache-first'     // WatermelonDB local DB queried first
  writes: 'optimistic'     // Local update immediately, sync when online
  sync: 'background'       // Background sync on connectivity change
  conflict: 'last-write-wins' // Simple LWW for document content
}
```

## Push Notification Flow

```mermaid
sequenceDiagram
    participant U as Device
    participant P as Push Service
    participant API as Meridian API
    participant W as WebSocket

    U->>P: Register device token
    P-->>API: Store token
    
    Note over API,W: Real-time event
    API->>W: New notification event
    W-->>U: In-app notification (if active)
    
    alt App in background
        API->>P: Send push via FCM/APNs
        P-->>U: Display notification
    end
    
    U->>API: Tap notification → deep link
    API-->>U: Navigate to target screen
```

## Best Practices

| Practice | Rationale |
|----------|----------|
| Share types and fragments from monorepo | Prevents drift between web and mobile API contracts; single source of truth for all GraphQL operations |
| WatermelonDB for offline cache | SQLite-based local database supports lazy loading, relations, and sync primitives out of the box |
| Biometric auth as secondary factor | Primary auth via Clerk session token; biometrics unlock the local session, not replace server auth |
| Optimistic updates with conflict resolution | Users see instant feedback on mutations; LWW strategy handles conflicts when reconnecting |

## Common Mistakes

| Mistake | Consequence | Fix |
|---------|-------------|-----|
| Building full web parity | Doubles feature maintenance cost; mobile becomes a bottleneck for web releases | Strictly scope mobile to companion use cases; each feature must pass "can it wait until desktop?" test |
| Ignoring offline error states | Users see stale data or cryptic errors when connectivity drops | Implement explicit offline banners + retry logic; cache timestamps show data freshness |
| Overfetching GraphQL on mobile | Slow screen loads on cellular connections | Use persisted queries + fragment masking; prefetch key screens on app launch |
| No biometric session lock | Unencrypted local data accessible if device is unlocked | Bind local cache encryption to biometric key; re-prompt on app background/resume |

## Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Local data exposure | WatermelonDB encrypted at rest via SQLCipher; encryption key derived from biometric + device keychain |
| API token storage | Clerk session tokens stored in iOS Keychain / Android EncryptedSharedPreferences; never in AsyncStorage |
| Deep link hijacking | Verified app links (Android App Links / iOS Universal Links); reject unregistered URL schemes |
| Push notification data leakage | Push payloads contain only message IDs; full content fetched via authenticated API call |
| Screenshot protection | Enable FLAG_SECURE on sensitive screens (chat, documents) for enterprise-managed devices |

## Performance Considerations

| Concern | Mitigation |
|---------|-----------|
| App cold start time | Lazy-load screen modules via React Native lazy imports; skeleton screens during initial data fetch |
| Offline sync bandwidth | Differential sync transmits only changed records; binary diff for document content |
| Image loading on cellular | Progressive JPEG loading; configurable image quality per connection type (WiFi vs cellular) |
| Navigation jank | Pre-warm tab screens on app launch; use react-native-screens native stack for gesture-backed transitions |
| Large document lists | FlatList with windowed rendering + memoization; batch size 20 items per page |

## Components

| Component | Responsibility | Technology | Scale Strategy |
|-----------|---------------|------------|----------------|
| DashboardScreen | Mobile summary cards and activity feed | React Native + Recharts | Lazy-loaded on tab focus; skeleton while fetching |
| ChatView | Agent conversation interface | React Native Gifted Chat | Singleton; message list virtualized with FlatList |
| QuickUploadFAB | Floating action button for camera/files/scanner | React Native + CameraKit | Floating across all screens; modal on press |
| OfflineSyncEngine | Background data synchronization | WatermelonDB + NetInfo | Singleton; differential sync on connectivity change |

## Workflows

1. **App cold start**: User opens app → splash screen displays → biometric auth prompt appears → Face ID / Fingerprint authenticates → tab navigator renders → active tab (Dashboard) fires data queries → skeleton screens show while loading → data renders
2. **Offline document upload**: User taps FAB → selects camera → captures document → WatermelonDB stores locally with `synced: false` → optimistic UI shows document in list → network reconnects → background sync pushes to server → conflict resolved (LWW) → sync badge updates
3. **Push notification → deep link**: User receives notification → taps it → app opens → deep link parsed → target screen resolved in navigator → screen loads with context from notification payload → WebSocket connects for real-time updates
4. **Biometric session lock**: App backgrounds → timer starts (5 min default) → user returns within timer → no re-auth → user returns after timer → biometric prompt shown → success → continue session → failure → logout with data preserved

## Data Flow

1. **Ingestion**: User actions on mobile → optimistic update to WatermelonDB local store → queued for sync → when online, differential sync transmits only changed records → server processes and returns confirmation
2. **Processing**: Apollo GraphQL client fragments shared with web → persisted queries reduce payload → normalized cache merged with WatermelonDB local data → conflict resolution via LWW
3. **Storage**: WatermelonDB SQLite database encrypted via SQLCipher → encryption key bound to biometric keychain → Clerk session tokens in iOS Keychain / Android EncryptedSharedPreferences
4. **Retrieval**: Reads use cache-first strategy → WatermelonDB queried first → stale data returned instantly → background sync updates cache → UI re-renders with fresh data
5. **Deletion**: User deletes document locally → optimistic removal from FlatList → sync sends DELETE to server → server confirms → record purged from WatermelonDB

## Scalability

| Dimension | Current Limit | 10x Strategy | 100x Strategy |
|-----------|---------------|--------------|---------------|
| Offline documents stored | 500 | WatermelonDB lazy-load with pagination (50 per page) | SQLite FTS5 full-text search indexing |
| Chat messages in FlatList | 1,000 | Windowed rendering with `getItemLayout` + `initialNumToRender: 20` | WASM-backed SQLite for 100k+ message histories |
| Push notification throughput | 100/min | Token grouping by locale/timezone for batched delivery | Segmented push with priority queue + silent fallback |
| Biometric re-auth frequency | Per app background > 5min | Adaptive timeouts based on user behavior patterns | Risk-based authentication (location, network, time) |

## Error Handling

| Scenario | Detection | Mitigation | Recovery |
|----------|-----------|------------|----------|
| Offline queue stalls on permanent conflict | Sync engine detects 3 consecutive failures | Flag item as "sync failed" with retry banner; surface to user | User taps retry; force re-upload with new revision ID |
| Biometric auth fails repeatedly | `LAContext` returns error > 3 times | Fall back to passcode-based app unlock | After 10 failures, logout with password re-auth required |
| Push notification token expires | FCM/APNs returns `Unregistered` error | Request new token on next app foreground | Update stored token via API; retry failed notification |
| Deep link URL malformed | Navigator cannot resolve route | Fall back to home screen; log error to Sentry | User navigates manually from home screen |

## Monitoring

| Metric | Alert Threshold | Severity | Dashboard |
|--------|----------------|----------|-----------|
| Offline sync failure rate | > 2% | Warning | Grafana — Mobile Sync Dashboard |
| App cold start time (p95) | > 3s | Critical | Grafana — Mobile Performance |
| Biometric auth failure rate | > 5% | Warning | Sentry — Mobile Auth |
| Push notification delivery rate | < 95% | Critical | FCM/APNs Console |
| Navigation jank (dropped frames) | > 5% of navigations | Warning | Grafana — Mobile Web Vitals |

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| iOS App Store review rejects update | Low | Critical | Follow App Store guidelines; allocate 2-week buffer for review |
| Android fragmentation causes device-specific bugs | High | Medium | Test on top 10 Android devices by user base; use feature detection |
| Offline sync conflicts cause data loss | Medium | High | LWW with version vectors; user notification on conflict resolution |
| Biometric API changes break auth on OS update | Low | High | Use platform biometric libraries (react-native-biometrics); test on beta OS versions |

## Limitations

| Limitation | Impact | Workaround | Future Resolution |
|------------|--------|------------|-------------------|
| Not a full web parity client | Some advanced features (memory graph editing, complex dashboards) unavailable | Clear feature parity documentation; deep-link to web for unsupported features | V3 full mobile app with all features |
| WatermelonDB sync is pull-based only | No real-time collaboration on mobile | Poll sync every 30s when app is foregrounded | WebSocket-based real-time sync with CRDTs |
| Biometric auth requires network on first setup | New device setup fails offline | Cache session token from web login during initial device pairing | Pre-generate device-specific offline tokens |

## Goals

- Achieve sub-3-second cold start time on iOS and Android devices (p95)
- Support full offline-read capability for Dashboard, Workspace, and Chat screens
- Maintain bi-directional sync with under 2% conflict rate through Last-Write-Wins resolution
- Encrypt all locally stored data with biometric-bound encryption keys
- Reduce mobile bundle size to under 10MB for over-the-air distribution

## Scope

### In Scope
- React Native companion app with 5 screens: Dashboard, Workspace, Chat, Notifications, Quick Upload
- Shared TypeScript types, GraphQL fragments, design tokens, and business logic with web monorepo
- Offline-first reads via WatermelonDB with SQLCipher encryption and background sync
- Push notifications via FCM/APNs with deep-link navigation to target screens
- Biometric authentication (Face ID / Fingerprint) as secondary factor for local session unlock

### Out of Scope
- Full web parity — mobile is a companion app for on-the-go access, not a complete replacement
- Real-time collaborative editing on mobile (future improvement)
- Apple Watch companion app (future improvement)
- Android Widget/iOS Shortcut support (future improvement)

## Examples

### Offline-First WatermelonDB Query

```typescript
import { database } from './database';
import { Q } from '@nozbe/watermelondb';

async function getDocuments(workspaceId: string) {
  const documents = await database.get('documents')
    .query(Q.where('workspace_id', workspaceId))
    .fetch();

  if (documents.length === 0) {
    // Fetch from API and sync
    const fresh = await fetch(`/api/workspaces/${workspaceId}/documents`).then(r => r.json());
    await database.write(async writer => {
      for (const doc of fresh) {
        await writer.create('documents', record => {
          record._raw = doc;
        });
      }
    });
    return fresh;
  }
  return documents;
}
```

### Biometric Auth Hook

```typescript
import * as LocalAuthentication from 'expo-local-authentication';

async function authenticateUser(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  if (!hasHardware || !isEnrolled) {
    // Fall back to PIN/password
    return authenticateWithPin();
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock Meridian',
    fallbackLabel: 'Use Passcode',
    disableDeviceFallback: false,
  });

  return result.success;
}
```

---

| Improvement | Priority | Complexity | Timeline |
|-------------|----------|------------|----------|
| Full offline mode with complete data access | High | High | Q3 2027 |
| Widget/shortcut iOS support for glanceable dashboard | Medium | Medium | Q2 2027 |
| Apple Watch companion for notification triage | Low | High | Q4 2027 |
| Real-time collaborative features via WebSocket | High | High | Q4 2027 |

## Related Documents

- [Frontend Architecture.md](./Frontend-Architecture.md)
- [UI Architecture.md](./UI-Architecture.md)
- [Design System.md](./Design-System.md)
- [API Architecture.md](../Backend/API-Architecture.md)
- [Responsive Design.md](./Responsive-Design.md)
