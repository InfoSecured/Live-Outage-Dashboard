import React, { useEffect, useState } from 'react';
import { DataCard } from './DataCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { BarChart, Download } from 'lucide-react';
import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { Outage } from '@shared/types';
import { api } from '@/lib/api-client';
import { Toaster, toast } from '@/components/ui/sonner';
import { format, subDays } from 'date-fns';
import { useDashboardStore } from '@/stores/dashboard-store';
type ChartData = {
  date: string;
  SEV1: number;
  SEV2: number;
  SEV3: number;
  Degraded: number;
};
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
  const refreshCounter = useDashboardStore((state) => state.refreshCounter);
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setIsLoading(true);
        const data = await api<Outage[]>('/api/outages/history');
        setHistory(data);
      } catch (error) {
        console.error("Failed to fetch outage history:", error);
        toast.error('Could not load outage history.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, [refreshCounter]);
  const handleExport = () => {
    if (history.length === 0) {
      toast.warning('No outage data to export.');
      return;
    }
    const formattedDate = format(new Date(), 'yyyy-MM-dd');
    downloadCSV(history, `aegis-outage-history-${formattedDate}.csv`);
    toast.success('Outage history exported successfully.');
  };
  const chartData = React.useMemo(() => {
    const dataMap = new Map<string, ChartData>();
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const formattedDate = format(date, 'MMM d');
      dataMap.set(formattedDate, { date: formattedDate, SEV1: 0, SEV2: 0, SEV3: 0, Degraded: 0 });
    }
    history.forEach(outage => {
      const date = format(new Date(outage.startTime), 'MMM d');
      if (dataMap.has(date)) {
        const dayData = dataMap.get(date)!;
        if (dayData[outage.impactLevel] !== undefined) {
          dayData[outage.impactLevel]++;
        }
      }
    });
    return Array.from(dataMap.values());
  }, [history]);
  return (
    <DataCard
      title="Outage Trends (Last 7 Days)"
      icon={BarChart}
      actions={
        <Button variant="outline" size="sm" className="gap-2" onClick={handleExport} disabled={isLoading}>
          <Download className="size-4" />
          Export
        </Button>
      }
    >
      <Toaster richColors />
      {isLoading ? (
        <Skeleton className="h-[350px] w-full" />
      ) : (
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsBarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  borderColor: 'hsl(var(--border))',
                  color: 'hsl(var(--foreground))'
                }}
              />
              <Bar dataKey="SEV1" stackId="a" fill="hsl(var(--destructive))" name="SEV1" />
              <Bar dataKey="SEV2" stackId="a" fill="hsl(var(--chart-5))" name="SEV2" />
              <Bar dataKey="SEV3" stackId="a" fill="hsl(var(--chart-4))" name="SEV3" />
              <Bar dataKey="Degraded" stackId="a" fill="hsl(var(--chart-1))" name="Degraded" />
            </RechartsBarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DataCard>
  );
}