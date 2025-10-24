import React, { useEffect, useState, useMemo } from 'react';
import { DataCard } from './DataCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Ticket } from 'lucide-react';
import type { ServiceNowTicket, TicketStatus } from '@shared/types';
import { api } from '@/lib/api-client';
import { Toaster, toast } from '@/components/ui/sonner';
import { useDashboardStore } from '@/stores/dashboard-store';
import { useShallow } from 'zustand/react/shallow';
const statusColors: Record<TicketStatus, string> = {
  'New': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'In Progress': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'On Hold': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  'Resolved': 'bg-green-500/20 text-green-400 border-green-500/30',
};
export function ServiceNowTicketsPanel() {
  const [tickets, setTickets] = useState<ServiceNowTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { searchQuery, refreshCounter } = useDashboardStore(
    useShallow((state) => ({
      searchQuery: state.searchQuery,
      refreshCounter: state.refreshCounter,
    }))
  );
  useEffect(() => {
    const fetchTickets = async () => {
      try {
        setIsLoading(true);
        const data = await api<ServiceNowTicket[]>('/api/servicenow/tickets');
        setTickets(data);
      } catch (error) {
        console.error("Failed to fetch ServiceNow tickets:", error);
        toast.error('Could not load ServiceNow tickets.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchTickets();
  }, [refreshCounter]);
  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      const query = searchQuery.toLowerCase();
      return (
        ticket.id.toLowerCase().includes(query) ||
        ticket.summary.toLowerCase().includes(query) ||
        ticket.affectedCI.toLowerCase().includes(query)
      );
    });
  }, [tickets, searchQuery]);
  return (
    <DataCard title="Recent ServiceNow Tickets" icon={Ticket} className="lg:col-span-1" contentClassName="pt-2">
      <Toaster richColors />
      <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1 -mr-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <TicketSkeleton key={i} />)
        ) : filteredTickets.length > 0 ? (
          filteredTickets.map((ticket) => <TicketItem key={ticket.id} ticket={ticket} />)
        ) : (
          <div className="text-center text-muted-foreground py-8">
            <p>No tickets match your criteria.</p>
          </div>
        )}
      </div>
    </DataCard>
  );
}
function TicketItem({ ticket }: { ticket: ServiceNowTicket }) {
  return (
    <div className="text-sm">
      <div className="flex items-start justify-between">
        <a href={ticket.ticketUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
          {ticket.id}
        </a>
        <Badge variant="outline" className={`text-xs ${statusColors[ticket.status]}`}>{ticket.status}</Badge>
      </div>
      <p className="text-muted-foreground truncate" title={ticket.summary}>{ticket.summary}</p>
      <p className="text-xs text-muted-foreground/80 mt-1">CI: {ticket.affectedCI}</p>
    </div>
  );
}
function TicketSkeleton() {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-5 w-24" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}