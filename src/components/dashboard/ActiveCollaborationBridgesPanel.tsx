import React, { useEffect, useState, useMemo } from 'react';
import { DataCard } from './DataCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Phone, Users, Zap, Settings } from 'lucide-react';
import type { CollaborationBridge } from '@shared/types';
import { api } from '@/lib/api-client';
import { Toaster, toast } from '@/components/ui/sonner';
import { useDashboardStore } from '@/stores/dashboard-store';
import { cn } from '@/lib/utils';
import { useShallow } from 'zustand/react/shallow';
import { ManageBridgesSheet } from './ManageBridgesSheet';

export function ActiveCollaborationBridgesPanel() {
  const [bridges, setBridges] = useState<CollaborationBridge[]>([]);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { searchQuery, refreshCounter } = useDashboardStore(
    useShallow((state) => ({
      searchQuery: state.searchQuery,
      refreshCounter: state.refreshCounter,
    }))
  );
  const fetchBridges = React.useCallback(async () => {
    const fetchBridges = async () => {
      try {
        setIsLoading(true);
        const data = await api<CollaborationBridge[]>('/api/collaboration/bridges');
        setBridges(data);
      } catch (error) {
        console.error("Failed to fetch collaboration bridges:", error);
        toast.error('Could not load collaboration bridges.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchBridges();
  }, []);

  useEffect(() => {
    fetchBridges();
  }, [refreshCounter, fetchBridges]);
  const filteredBridges = useMemo(() => {
    return bridges.filter(bridge => {
      const query = searchQuery.toLowerCase();
      return bridge.title.toLowerCase().includes(query);
    });
  }, [bridges, searchQuery]);
  return (
    <>
      <DataCard
        title="Active Bridges"
        icon={Phone}
        className="lg:col-span-1"
        contentClassName="pt-2"
        actions={
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => setIsSheetOpen(true)}>
            <Settings className="size-4" />
            Manage
          </Button>
        }
      >
        <Toaster richColors />
        <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1 -mr-2">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <BridgeSkeleton key={i} />)
          ) : filteredBridges.length > 0 ? (
            filteredBridges.map((bridge) => <BridgeItem key={bridge.id} bridge={bridge} />)
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <p>No active collaboration bridges.</p>
            </div>
          )}
        </div>
      </DataCard>
      <ManageBridgesSheet isOpen={isSheetOpen} onOpenChange={setIsSheetOpen} onBridgesUpdate={fetchBridges} />
    </>
  );
}
function BridgeItem({ bridge }: { bridge: CollaborationBridge }) {
  return (
    <div className={cn(
      "p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors",
      bridge.isHighSeverity && "border-red-500/50 bg-red-500/10"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="font-semibold text-sm text-foreground truncate" title={bridge.title}>
            {bridge.title}
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
            <div className="flex items-center gap-1.5">
              <Users className="size-3" />
              <span>{bridge.participants} participants</span>
            </div>
            <span>{bridge.duration}</span>
          </div>
        </div>
        <Button size="sm" variant="outline" className="gap-2 shrink-0" onClick={() => window.open(bridge.teamsCallUrl, '_blank')}>
          Join
          <Phone className="size-3.5" />
        </Button>
      </div>
      {bridge.isHighSeverity && (
        <div className="flex items-center gap-1.5 text-xs text-red-400 mt-2">
          <Zap className="size-3.5" />
          <span>High Severity Incident</span>
        </div>
      )}
    </div>
  );
}
function BridgeSkeleton() {
  return (
    <div className="p-3 rounded-lg border">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-3/4" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-10" />
          </div>
        </div>
        <Skeleton className="h-9 w-20" />
      </div>
    </div>
  );
}