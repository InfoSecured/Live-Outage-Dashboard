import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { DataCard } from './DataCard';
import { StatusIndicator } from './StatusIndicator';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BellRing, CheckCircle2, Settings, AlertCircle } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import type { MonitoringAlert } from '@shared/types';
import { api } from '@/lib/api-client';
import { Toaster, toast } from '@/components/ui/sonner';
import { useDashboardStore } from '@/stores/dashboard-store';
import { useShallow } from 'zustand/react/shallow';
import { ManageSolarWindsSheet } from './ManageSolarWindsSheet';
export function MonitoringAlertsPanel() {
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'validated'>('all');
  const { searchQuery, refreshCounter } = useDashboardStore(
    useShallow((state) => ({
      searchQuery: state.searchQuery,
      refreshCounter: state.refreshCounter,
    }))
  );
  const fetchAlerts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api<MonitoringAlert[]>('/api/monitoring/alerts');
      setAlerts(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Could not load monitoring alerts.';
      setError(errorMessage);
      setAlerts([]); // Clear stale data on error
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);
  useEffect(() => {
    fetchAlerts();
  }, [refreshCounter, fetchAlerts]);
  const filteredAlerts = useMemo(() => {
    return alerts
      .filter(alert => {
        if (filter === 'validated') return alert.validated;
        return true;
      })
      .filter(alert => {
        const query = searchQuery.toLowerCase();
        return (
          alert.affectedSystem.toLowerCase().includes(query) ||
          alert.type.toLowerCase().includes(query)
        );
      });
  }, [alerts, filter, searchQuery]);
  const isNotConfigured = error?.includes('not configured');
  return (
    <>
      <DataCard
        title="Monitoring Alerts"
        icon={BellRing}
        className="lg:col-span-1"
        contentClassName="pt-2"
        actions={
          <div className="flex items-center gap-1">
            <ToggleGroup type="single" value={filter} onValueChange={(value) => value && setFilter(value as 'all' | 'validated')} size="sm">
              <ToggleGroupItem value="all" aria-label="All alerts">All</ToggleGroupItem>
              <ToggleGroupItem value="validated" aria-label="Validated alerts">Validated</ToggleGroupItem>
            </ToggleGroup>
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setIsSheetOpen(true)}>
              <Settings className="size-4" />
            </Button>
          </div>
        }
      >
        <Toaster richColors />
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 -mr-2">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <AlertSkeleton key={i} />)
          ) : isNotConfigured ? (
             <div className="text-center text-muted-foreground py-8">
              <AlertCircle className="mx-auto size-10 text-yellow-500 mb-2" />
              <h3 className="font-semibold text-foreground">Not Configured</h3>
              <p className="text-sm">Please configure the SolarWinds integration to see live alerts.</p>
            </div>
          ) : error ? (
            <div className="text-center text-red-500 py-8 text-sm">{error}</div>
          ) : filteredAlerts.length > 0 ? (
            filteredAlerts.map((alert) => <AlertItem key={alert.id} alert={alert} />)
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <p>No alerts match your criteria.</p>
            </div>
          )}
        </div>
      </DataCard>
      <ManageSolarWindsSheet
        isOpen={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        onConfigUpdate={fetchAlerts}
      />
    </>
  );
}
function AlertItem({ alert }: { alert: MonitoringAlert }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <StatusIndicator status={alert.severity} className="mt-1" />
      <div>
        <p className="font-medium text-foreground">{alert.type}</p>
        <p className="text-muted-foreground">{alert.affectedSystem}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground/80 mt-1">
          <span>{formatDistanceToNow(parseISO(alert.timestamp), { addSuffix: true })}</span>
          {alert.validated && (
            <>
              <span>&middot;</span>
              <div className="flex items-center gap-1 text-green-500">
                <CheckCircle2 className="size-3" />
                <span>Validated</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
function AlertSkeleton() {
  return (
    <div className="flex items-start gap-3">
      <Skeleton className="size-2.5 rounded-full mt-1" />
      <div className="space-y-1.5 flex-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </div>
  );
}