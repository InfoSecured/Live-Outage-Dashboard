import React, { useEffect, useState, useMemo } from 'react';
import { DataCard } from './DataCard';
import { StatusIndicator } from './StatusIndicator';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Phone, Clock } from 'lucide-react';
import { formatDistanceToNow, parseISO, isWithinInterval } from 'date-fns';
import type { Outage, ImpactLevel } from '@shared/types';
import { api } from '@/lib/api-client';
import { Toaster, toast } from '@/components/ui/sonner';
import { useDashboardStore } from '@/stores/dashboard-store';
import { useShallow } from 'zustand/react/shallow';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
const impactLevelColors: Record<ImpactLevel, string> = {
  SEV1: 'text-red-500 border-red-500/50 bg-red-500/10',
  SEV2: 'text-orange-500 border-orange-500/50 bg-orange-500/10',
  SEV3: 'text-yellow-500 border-yellow-500/50 bg-yellow-500/10',
  Degraded: 'text-blue-500 border-blue-500/50 bg-blue-500/10',
};
export function ActiveOutagesPanel() {
  const [outages, setOutages] = useState<Outage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { searchQuery, selectedImpactLevels, dateRange, refreshCounter } = useDashboardStore(
    useShallow((state) => ({
      searchQuery: state.searchQuery,
      selectedImpactLevels: state.selectedImpactLevels,
      dateRange: state.dateRange,
      refreshCounter: state.refreshCounter,
    }))
  );
  useEffect(() => {
    const fetchOutages = async () => {
      try {
        setIsLoading(true);
        const data = await api<Outage[]>('/api/outages/active');
        setOutages(data);
      } catch (error) {
        console.error("Failed to fetch active outages:", error);
        toast.error('Could not load active outages.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchOutages();
  }, [refreshCounter]);
  const filteredOutages = useMemo(() => {
    return outages.filter(outage => {
      const query = searchQuery.toLowerCase();
      const searchMatch = outage.systemName.toLowerCase().includes(query) ||
                          outage.description.toLowerCase().includes(query);
      const impactMatch = selectedImpactLevels.size === 0 || selectedImpactLevels.has(outage.impactLevel);
      const dateMatch = !dateRange?.from || isWithinInterval(parseISO(outage.startTime), {
        start: dateRange.from,
        end: dateRange.to || new Date(),
      });
      return searchMatch && impactMatch && dateMatch;
    });
  }, [outages, searchQuery, selectedImpactLevels, dateRange]);
  return (
    <DataCard title="Active Outages" icon={AlertTriangle} className="lg:col-span-2" contentClassName="pt-2">
      <Toaster richColors />
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <OutageSkeleton key={i} />)
        ) : filteredOutages.length > 0 ? (
          filteredOutages.map((outage) => <OutageItem key={outage.id} outage={outage} />)
        ) : (
          <div className="text-center text-muted-foreground py-8">
            <p>No active outages match your criteria.</p>
          </div>
        )}
      </div>
    </DataCard>
  );
}
function OutageItem({ outage }: { outage: Outage }) {
  return (
    <div className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <StatusIndicator status={outage.impactLevel} />
            <h3 className="font-semibold text-foreground">{outage.systemName}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{outage.description}</p>
        </div>
        <div className="flex sm:flex-col items-end sm:items-end gap-2 sm:gap-1 flex-shrink-0">
          <div className={`text-xs font-bold px-2 py-1 rounded-md border ${impactLevelColors[outage.impactLevel]}`}>
            {outage.impactLevel}
          </div>
          {outage.teamsBridgeUrl && (
            <Button size="sm" variant="secondary" className="gap-2" onClick={() => window.open(outage.teamsBridgeUrl, '_blank')}>
              <Phone className="size-4" />
              Join Call
            </Button>
          )}
        </div>
      </div>
      <div className="border-t my-3"></div>
      <TooltipProvider>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 cursor-default">
                  <Clock className="size-3.5" />
                  <span>Started {formatDistanceToNow(parseISO(outage.startTime), { addSuffix: true })}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{new Date(outage.startTime).toLocaleString()}</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 cursor-default">
                  <span>ETA: {formatDistanceToNow(parseISO(outage.eta))}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{new Date(outage.eta).toLocaleString()}</p>
              </TooltipContent>
            </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}
function OutageSkeleton() {
  return (
    <div className="p-4 rounded-lg border">
      <div className="flex justify-between items-start">
        <div className="flex-1 pr-4">
          <div className="flex items-center gap-3 mb-2">
            <Skeleton className="size-2.5 rounded-full" />
            <Skeleton className="h-5 w-3/4" />
          </div>
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="flex flex-col items-end gap-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <div className="border-t my-3"></div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}