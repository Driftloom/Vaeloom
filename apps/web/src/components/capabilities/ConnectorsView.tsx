'use client';

import React from 'react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ConnectorDetailDrawer } from './ConnectorDetailDrawer';
import {
  ConnectorsHeader,
  ConnectorsDirectory,
  CustomProtocolsTab,
  InstalledConnectorsTab,
  CustomProtocolModal,
  ConnectorModals,
  useConnectorsState,
  type ConnectorsViewProps,
  rowActionCount,
  rowAssignedAgents,
  rowCategoryText,
  rowComposioApp,
  rowDescription,
  rowIcon,
  rowId,
  rowName,
  rowProtocol,
  rowProvider,
  rowScopes,
} from './connectors';

export function ConnectorsView({
  workspaceId,
  searchQuery = '',
  openAddTrigger,
}: ConnectorsViewProps) {
  const {
    workspaceLoading,
    activeSubTab,
    setActiveSubTab,
    internalSearch,
    setInternalSearch,
    selectedFilter,
    setSelectedFilter,
    showAllConnectors,
    setShowAllConnectors,
    dynamicConnectors,
    dynamicError,
    composioAppsError,
    composioTotalCount,
    composioEnabled,
    builtinServers,
    builtinError,
    composioSyncing,
    loadingDynamic,
    busyAction,
    setBusyAction,
    syncBusyId,
    isAddModalOpen,
    setIsAddModalOpen,
    selectedItemDetails,
    setSelectedItemDetails,
    pendingProvider,
    setPendingProvider,
    healthTarget,
    setHealthTarget,
    healthLoading,
    pendingDisconnect,
    setPendingDisconnect,
    toolsModalTarget,
    setToolsModalTarget,
    toolsList,
    toolsLoading,
    customType,
    setCustomType,
    customName,
    setCustomName,
    customUrl,
    setCustomUrl,
    customApiKey,
    setCustomApiKey,
    customMcpTransport,
    setCustomMcpTransport,
    customCommand,
    setCustomCommand,
    customArgs,
    setCustomArgs,
    submittingCustom,
    effectiveQuery,
    fullCatalogList,
    activeCategoryFilter,
    filteredCatalog,
    topConnectors,
    otherConnectors,
    configuredItems,
    customConnectors,
    isRowConnected,
    loadDynamicData,
    handleInitiateConnect,
    handleExecuteConnect,
    handleSyncAllComposio,
    handleSyncWorkspace,
    handleDynamicSync,
    handleTestConnection,
    handleOpenHealthModal,
    handleInspectTools,
    confirmDisconnect,
    handleCreateCustomConnector,
  } = useConnectorsState({ workspaceId, searchQuery, openAddTrigger });

  if (workspaceLoading) {
    return (
      <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-background text-text antialiased overflow-hidden">
        <h2 className="text-base sm:text-lg font-semibold tracking-tight text-text font-sans px-4 sm:px-6 py-2.5 shrink-0">
          Connectors Studio
        </h2>
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner text="Loading connectors..." />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-background text-text antialiased overflow-hidden">
      <ConnectorsHeader
        activeSubTab={activeSubTab}
        onTabChange={setActiveSubTab}
        composioTotalCount={composioTotalCount}
        composioEnabled={composioEnabled}
        installedCount={configuredItems.length}
        composioSyncing={composioSyncing}
        onSyncAllComposio={() => void handleSyncAllComposio()}
        onOpenAddModal={() => setIsAddModalOpen(true)}
      />

      <div
        aria-label="Connector workspace"
        aria-busy={loadingDynamic}
        className="flex-1 overflow-y-auto overscroll-y-contain px-4 sm:px-6 lg:px-8 py-5 pb-16 min-h-0 min-w-0 bg-background"
      >
        {activeSubTab === 'discover' ? (
          <ConnectorsDirectory
            fullCatalogList={fullCatalogList}
            filteredCatalog={filteredCatalog}
            topConnectors={topConnectors}
            otherConnectors={otherConnectors}
            activeCategoryFilter={activeCategoryFilter}
            internalSearch={internalSearch}
            onSearchChange={setInternalSearch}
            selectedFilter={selectedFilter}
            onFilterChange={setSelectedFilter}
            showAllConnectors={showAllConnectors}
            onShowAllConnectorsChange={setShowAllConnectors}
            onResetFilters={() => {
              setShowAllConnectors(false);
              setInternalSearch('');
              setSelectedFilter('All');
            }}
            effectiveQuery={effectiveQuery}
            composioEnabled={composioEnabled}
            composioAppsError={composioAppsError}
            onRetryLoad={() => void loadDynamicData()}
            isRowConnected={isRowConnected}
            busyAction={busyAction}
            onSelectRow={setSelectedItemDetails}
            onConnectRow={handleInitiateConnect}
          />
        ) : activeSubTab === 'studio' ? (
          <CustomProtocolsTab
            customConnectors={customConnectors}
            builtinServers={builtinServers}
            builtinError={builtinError}
            dynamicError={dynamicError}
            busyAction={busyAction}
            healthLoading={healthLoading}
            onRetryLoad={() => void loadDynamicData()}
            onOpenAddCustom={(type) => {
              if (type) setCustomType(type);
              setIsAddModalOpen(true);
            }}
            onConfigureBuiltin={(server) => {
              setBusyAction(`composio-${server.id}`);
              setCustomType('mcp');
              setCustomName(server.name);
              setCustomMcpTransport('stdio');
              setCustomCommand(String(server.config?.['command'] ?? ''));
              setCustomArgs(
                Array.isArray(server.config?.['args'])
                  ? server.config['args'].map((arg) => String(arg)).join(' ')
                  : '',
              );
              setIsAddModalOpen(true);
              setBusyAction(null);
            }}
            onTestConnection={(id) => void handleTestConnection(id)}
            onOpenHealthModal={(id) => void handleOpenHealthModal(id)}
            onInspectTools={(id, name) => void handleInspectTools(id, name)}
            onPendingDisconnect={setPendingDisconnect}
          />
        ) : (
          <InstalledConnectorsTab
            configuredItems={configuredItems}
            onBrowseDirectory={() => setActiveSubTab('discover')}
            syncBusyId={syncBusyId}
            busyAction={busyAction}
            onSyncWorkspace={(conn) => void handleSyncWorkspace(conn)}
            onDynamicSync={(id) => void handleDynamicSync(id)}
            onTestConnection={(id) => void handleTestConnection(id)}
            onInspectTools={(id, name) => void handleInspectTools(id, name)}
            onPendingDisconnect={setPendingDisconnect}
          />
        )}
      </div>

      {selectedItemDetails && (
        <ConnectorDetailDrawer
          isOpen={selectedItemDetails !== null}
          onClose={() => setSelectedItemDetails(null)}
          row={{
            id: rowId(selectedItemDetails),
            name: rowName(selectedItemDetails),
            provider: rowProvider(selectedItemDetails),
            protocol: rowProtocol(selectedItemDetails),
            category: rowCategoryText(selectedItemDetails),
            description: rowDescription(selectedItemDetails),
            scopes: rowScopes(selectedItemDetails),
            assignedAgents: rowAssignedAgents(selectedItemDetails),
            composioApp: rowComposioApp(selectedItemDetails),
            actionCount: rowActionCount(selectedItemDetails),
            icon: rowIcon(selectedItemDetails),
          }}
          connected={isRowConnected(selectedItemDetails)}
          connectorId={
            dynamicConnectors.find(
              (c) =>
                (c.name && c.name.toLowerCase() === rowName(selectedItemDetails).toLowerCase()) ||
                (c.config?.['app'] &&
                  String(c.config['app']).toLowerCase() ===
                    (rowComposioApp(selectedItemDetails) || '').toLowerCase()),
            )?.id ?? null
          }
          workspaceId={workspaceId}
          onConnect={() => {
            const current = selectedItemDetails;
            setSelectedItemDetails(null);
            handleInitiateConnect(current);
          }}
          onDisconnect={() => {
            const current = selectedItemDetails;
            setSelectedItemDetails(null);
            setPendingDisconnect({
              id: rowId(current),
              name: rowName(current),
              isWorkspaceIntegration: false,
            });
          }}
          connectBusy={busyAction === `composio-${rowComposioApp(selectedItemDetails) ?? ''}`}
          onRefresh={() => void loadDynamicData()}
        />
      )}

      <CustomProtocolModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        customType={customType}
        onCustomTypeChange={setCustomType}
        customName={customName}
        onCustomNameChange={setCustomName}
        customUrl={customUrl}
        onCustomUrlChange={setCustomUrl}
        customApiKey={customApiKey}
        onCustomApiKeyChange={setCustomApiKey}
        customMcpTransport={customMcpTransport}
        onCustomMcpTransportChange={setCustomMcpTransport}
        customCommand={customCommand}
        onCustomCommandChange={setCustomCommand}
        customArgs={customArgs}
        onCustomArgsChange={setCustomArgs}
        submittingCustom={submittingCustom}
        onSubmit={handleCreateCustomConnector}
      />

      <ConnectorModals
        pendingProvider={pendingProvider}
        onClosePendingProvider={() => setPendingProvider(null)}
        onExecuteConnect={(provider) => void handleExecuteConnect(provider)}
        busyAction={busyAction}
        healthTarget={healthTarget}
        healthLoading={healthLoading}
        onCloseHealthTarget={() => setHealthTarget(null)}
        toolsModalTarget={toolsModalTarget}
        toolsList={toolsList}
        toolsLoading={toolsLoading}
        onCloseToolsModal={() => setToolsModalTarget(null)}
        pendingDisconnect={pendingDisconnect}
        onClosePendingDisconnect={() => setPendingDisconnect(null)}
        onConfirmDisconnect={() => void confirmDisconnect()}
      />
    </div>
  );
}
