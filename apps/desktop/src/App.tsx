import { useEffect, useState } from 'react';
import { Spinner } from '@swyftgrid/ui';
import { useSettings } from '@/stores/settings';
import { useConnections } from '@/stores/connections';
import { useWorkspace, tabIds } from '@/stores/workspace';
import { useThemeEffect, useGlobalHotkeys } from '@/lib/hooks';
import { TitleBar } from '@/components/layout/TitleBar';
import { ProductionBanner } from '@/components/layout/ProductionBanner';
import { WebAuthBanner } from '@/components/layout/WebAuthBanner';
import { DemoBanner } from '@/components/layout/DemoBanner';
import { Sidebar } from '@/components/layout/Sidebar';
import { TabBar } from '@/components/layout/TabBar';
import { Workspace } from '@/components/layout/Workspace';
import { StatusBar } from '@/components/layout/StatusBar';
import { CommandPalette } from '@/components/command/CommandPalette';
import { UniversalSearch } from '@/components/command/UniversalSearch';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ContextMenu } from '@/components/common/ContextMenu';
import { Toaster } from '@/components/common/Toaster';

export function App() {
  const [ready, setReady] = useState(false);
  const loadSettings = useSettings((s) => s.load);
  const loadConnections = useConnections((s) => s.load);
  const open = useWorkspace((s) => s.open);

  useThemeEffect();
  useGlobalHotkeys();

  useEffect(() => {
    Promise.all([loadSettings(), loadConnections()]).finally(() => {
      // Start on the Connection Manager.
      open({ id: tabIds.connections(), kind: 'connections', title: 'Connections' });
      setReady(true);
    });
  }, [loadSettings, loadConnections, open]);

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center bg-bg">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-bg text-content">
      <TitleBar />
      <DemoBanner />
      <WebAuthBanner />
      <ProductionBanner />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col border-l border-border">
          <TabBar />
          <Workspace />
        </main>
      </div>
      <StatusBar />

      <CommandPalette />
      <UniversalSearch />
      <ConfirmDialog />
      <ContextMenu />
      <Toaster />
    </div>
  );
}
