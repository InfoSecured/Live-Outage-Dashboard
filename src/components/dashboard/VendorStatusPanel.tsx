import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { DataCard } from './DataCard';
import { StatusIndicator } from './StatusIndicator';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ExternalLink, ListChecks, Settings } from 'lucide-react';
import type { VendorStatus } from '@shared/types';
import { api } from '@/lib/api-client';
import { Toaster, toast } from '@/components/ui/sonner';
import { useDashboardStore } from '@/stores/dashboard-store';
import { useShallow } from 'zustand/react/shallow';
import { ManageVendorsSheet } from './ManageVendorsSheet';
export function VendorStatusPanel() {
  const [statuses, setStatuses] = useState<VendorStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const { searchQuery, refreshCounter } = useDashboardStore(
    useShallow((state) => ({
      searchQuery: state.searchQuery,
      refreshCounter: state.refreshCounter,
    }))
  );
  const fetchStatuses = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api<VendorStatus[]>('/api/vendors/status');
      setStatuses(data);
    } catch (error) {
      console.error("Failed to fetch vendor statuses:", error);
      toast.error('Could not load vendor statuses.');
    } finally {
      setIsLoading(false);
    }
  }, []);
  useEffect(() => {
    fetchStatuses();
  }, [refreshCounter, fetchStatuses]);
  const filteredStatuses = useMemo(() => {
    return statuses.filter(status =>
      status.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [statuses, searchQuery]);
  return (
    <>
      <DataCard
        title="Vendor Status"
        icon={ListChecks}
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
        <div className="space-y-4">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <VendorStatusSkeleton key={i} />)
          ) : filteredStatuses.length > 0 ? (
            filteredStatuses.map((vendor) => (
              <div key={vendor.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <StatusIndicator status={vendor.status} />
                  <span className="font-medium text-foreground">{vendor.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">{vendor.status}</span>
                  <a
                    href={vendor.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors"
                    aria-label={`View ${vendor.name} status page`}
                  >
                    <ExternalLink className="size-4" />
                  </a>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <p>No vendors match your search.</p>
            </div>
          )}
        </div>
      </DataCard>
      <ManageVendorsSheet
        isOpen={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        onVendorsUpdate={fetchStatuses}
      />
    </>
  );
}
function VendorStatusSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Skeleton className="size-2.5 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="size-4" />
      </div>
    </div>
  );
}