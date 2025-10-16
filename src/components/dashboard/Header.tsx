import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Search, ShieldCheck, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { useDashboardStore } from '@/stores/dashboard-store';
import { cn } from '@/lib/utils';
import { DatePickerWithRange } from './DatePickerWithRange';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ImpactLevel } from '@shared/types';
import { ThemeToggle } from '../ThemeToggle';
import { useShallow } from 'zustand/react/shallow';
const ALL_IMPACT_LEVELS: ImpactLevel[] = ['Outage', 'Degradation'];
export function Header() {
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  // CORRECT: Select state values with useShallow for stability
  const { searchQuery, selectedImpactLevels, dateRange } = useDashboardStore(
    useShallow((state) => ({
      searchQuery: state.searchQuery,
      selectedImpactLevels: state.selectedImpactLevels,
      dateRange: state.dateRange,
    }))
  );
  // CORRECT: Select actions individually. Zustand guarantees actions are stable.
  // This prevents the infinite loop caused by creating a new object on every render.
  const setSearchQuery = useDashboardStore((state) => state.setSearchQuery);
  const setSelectedImpactLevels = useDashboardStore((state) => state.setSelectedImpactLevels);
  const setDateRange = useDashboardStore((state) => state.setDateRange);
  const refreshData = useDashboardStore((state) => state.refreshData);
  const handleImpactLevelChange = (level: ImpactLevel) => {
    setSelectedImpactLevels((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(level)) {
        newSet.delete(level);
      } else {
        newSet.add(level);
      }
      return newSet;
    });
  };
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setLastUpdated(new Date());
    setIsRefreshing(false);
  };
  useEffect(() => {
    const timer = setInterval(() => setLastUpdated(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  return (
    <header className="mb-8 space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="size-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground font-display tracking-tight">
              Live Outage Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Last updated: {format(lastUpdated, 'MMM d, yyyy, h:mm:ss a')}
            </p>
          </div>
        </div>
        <div className="flex w-full sm:w-auto items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={cn('size-4', isRefreshing && 'animate-spin')} />
          </Button>
          <ThemeToggle />
        </div>
      </div>
      <div className="flex flex-col md:flex-row items-center gap-2">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search systems, vendors, tickets..."
            className="pl-10 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto justify-between">
                Impact Level{' '}
                {selectedImpactLevels.size > 0 && `(${selectedImpactLevels.size})`}
                <ChevronDown className="ml-2 size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Filter by Impact</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ALL_IMPACT_LEVELS.map((level) => (
                <DropdownMenuCheckboxItem
                  key={level}
                  checked={selectedImpactLevels.has(level)}
                  onCheckedChange={() => handleImpactLevelChange(level)}
                >
                  {level}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DatePickerWithRange date={dateRange} setDate={setDateRange} />
        </div>
      </div>
    </header>
  );
}