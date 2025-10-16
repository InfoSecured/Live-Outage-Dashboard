import { create } from 'zustand';
import type { DateRange } from 'react-day-picker';
import type { ImpactLevel } from '@shared/types';
interface DashboardState {
  searchQuery: string;
  selectedImpactLevels: Set<ImpactLevel>;
  dateRange: DateRange | undefined;
  refreshCounter: number;
  setSearchQuery: (query: string) => void;
  setSelectedImpactLevels: (updateFn: (prev: Set<ImpactLevel>) => Set<ImpactLevel>) => void;
  setDateRange: (range: DateRange | undefined) => void;
  refreshData: () => Promise<void>;
}
export const useDashboardStore = create<DashboardState>((set) => ({
  searchQuery: '',
  selectedImpactLevels: new Set<ImpactLevel>(),
  dateRange: undefined,
  refreshCounter: 0,
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedImpactLevels: (updateFn) => set((state) => ({ selectedImpactLevels: updateFn(state.selectedImpactLevels) })),
  setDateRange: (range) => set({ dateRange: range }),
  refreshData: async () => {
    set((state) => ({ refreshCounter: state.refreshCounter + 1 }));
    return Promise.resolve();
  },
}));