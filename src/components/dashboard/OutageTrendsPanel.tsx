import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { DataCard } from './DataCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { BarChart, Download, AlertCircle } from 'lucide-react';
import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import type { Outage, ImpactLevel } from '@shared/types';
import { api } from '@/lib/api-client';
import { Toaster, toast } from '@/components/ui/sonner';
import { format, subDays, parseISO } from 'date-fns';
import { useDashboardStore } from '@/stores/dashboard-store';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
type BreakdownType = 'impact' | 'system';
type ChartData = {
  date: string;
  [key: string]: number | string;
};
// Normalize system labels so "Printer ", "printer", etc. collapse to one key
const normalizeSystem = (name: string) => (name || 'Unknown System').trim();

const IMPACT_LEVELS: ImpactLevel[] = ['Outage', 'Degradation'];
const IMPACT_COLORS: Record<ImpactLevel, string> = {
  Outage: 'hsl(var(--destructive))',
  Degradation: 'hsl(var(--chart-4))',
};
const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];
const downloadCSV = (data: Outage[], filename: string) => {
  const header = ['ID', 'System Name', 'Impact Level', 'Start Time', 'ETA', 'Description', 'Teams Bridge URL'];
  const rows = data.map(outage => [
    outage.id,
    `"${outage.systemName.replace(/"/g, '""')}"`,
    outage.impactLevel,
    outage.startTime,
    outage.eta,
    `"${outage.description.replace(/"/g, '""')}"`,
    outage.teamsBridgeUrl || ''
  ].join(','));
  const csvContent = [header.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
export function OutageTrendsPanel() {
  const [history, setHistory] = useState<Outage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [breakdownType, setBreakdownType] = useState<BreakdownType>('impact');
  const refreshCounter = useDashboardStore((state) => state.refreshCounter);
  const fetchHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api<Outage[]>('/api/outages/history');
      setHistory(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Could not load outage history.';
      setError(errorMessage);
      setHistory([]);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);
  useEffect(() => {
    fetchHistory();
  }, [refreshCounter, fetchHistory]);
  const handleExport = () => {
    if (history.length === 0) {
      toast.warning('No outage data to export.');
      return;
    }
    const formattedDate = format(new Date(), 'yyyy-MM-dd');
    downloadCSV(history, `aegis-outage-history-${formattedDate}.csv`);
    toast.success('Outage history exported successfully.');
  };
  const { chartData, keys: dynamicKeys } = useMemo(() => {
  type ChartRow = { dayKey: string; date: string } & Record<string, number>;
  const normalizeSystem = (name: string) => (name || 'Unknown System').trim();

  // 7-day window (today inclusive)
  const sevenDaysAgo = subDays(new Date(), 6);

  // Stable day buckets
  const dataMap = new Map<string, ChartRow>();
  for (let offset = 6; offset >= 0; offset--) {
    const day = subDays(new Date(), offset);
    const dayKey = format(day, 'yyyy-MM-dd');
    const label  = format(day, 'MMM d');
    dataMap.set(dayKey, { dayKey, date: label });
  }

  if (breakdownType === 'impact') {
    const impactKeys = [...IMPACT_LEVELS];
    // init zeros
    dataMap.forEach(row => impactKeys.forEach(k => (row[k] = 0)));
    // count
    for (const outage of history) {
      const dt = parseISO(outage.startTime);
      if (dt < sevenDaysAgo) continue;
      const dayKey = format(dt, 'yyyy-MM-dd');
      const row = dataMap.get(dayKey);
      if (!row) continue;
      if (impactKeys.includes(outage.impactLevel)) {
        row[outage.impactLevel] = (row[outage.impactLevel] as number) + 1;
      }
    }
    return { chartData: Array.from(dataMap.values()), keys: impactKeys };
  }

  // === By System Name ===
  // 1) Build counts
  const allSystemNames = new Set<string>();
  for (const outage of history) {
    const dt = parseISO(outage.startTime);
    if (dt < sevenDaysAgo) continue;
    const dayKey = format(dt, 'yyyy-MM-dd');
    const row = dataMap.get(dayKey);
    if (!row) continue;
    const sys = normalizeSystem(outage.systemName);
    allSystemNames.add(sys);
    row[sys] = ((row[sys] as number) || 0) + 1;
  }

  // 2) Keep only systems that have at least one non-zero in the 7-day window
  const systemsWithCounts: string[] = Array.from(allSystemNames).filter(sys =>
    Array.from(dataMap.values()).some(r => (r[sys] as number) > 0)
  ).sort();

  // 3) Ensure every row has explicit zeros for the final system list (helps Recharts stack)
  dataMap.forEach(row => {
    systemsWithCounts.forEach(sys => {
      if (typeof row[sys] !== 'number') row[sys] = 0;
    });
  });

  return { chartData: Array.from(dataMap.values()), keys: systemsWithCounts };
}, [history, breakdownType]);
  // THIS ENDS THE useMemo section
  const isNotConfigured = error?.includes('not configured');
  return (
    <DataCard
      title="Outage Trends (Last 7 Days)"
      icon={BarChart}
      actions={
        <div className="flex items-center gap-2">
          <Select value={breakdownType} onValueChange={(value: BreakdownType) => setBreakdownType(value)}>
            <SelectTrigger className="w-[180px] text-xs sm:text-sm">
              <SelectValue placeholder="Breakdown by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="impact">By Impact Level</SelectItem>
              <SelectItem value="system">By System Name</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExport} disabled={isLoading || history.length === 0}>
            <Download className="size-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      }
    >
      <Toaster richColors />
      <div className="h-[350px]">
        {isLoading ? (
          <Skeleton className="h-full w-full" />
        ) : isNotConfigured ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <AlertCircle className="mx-auto size-10 text-yellow-500 mb-2" />
            <h3 className="font-semibold text-foreground">Not Configured</h3>
            <p className="text-sm">Please configure the ServiceNow integration to see outage history.</p>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-red-500 text-sm">{error}</div>
        ) : history.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>No outage history found for the last 7 days.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <RechartsBarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} width={30} />
              <Tooltip
                cursor={{ fill: 'hsl(var(--accent))' }}
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  borderColor: 'hsl(var(--border))',
                  color: 'hsl(var(--foreground))'
                }}
              />
              <Legend iconSize={10} wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
              {breakdownType === 'impact'
                ? IMPACT_LEVELS.map(level => (
                    <Bar key={level} dataKey={level} stackId="a" fill={IMPACT_COLORS[level]} name={level} />
                  ))
                : dynamicKeys.map((systemName, index) => (
                    <Bar key={systemName} dataKey={systemName} stackId="a" fill={CHART_COLORS[index % CHART_COLORS.length]} name={systemName} />
                  ))
              }
            </RechartsBarChart>
          </ResponsiveContainer>
        )}
      </div>
    </DataCard>
  );
}
