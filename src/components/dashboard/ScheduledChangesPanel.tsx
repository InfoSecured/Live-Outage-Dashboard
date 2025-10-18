import { useEffect, useState } from 'react';
import { DataCard } from './DataCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

type ChangeItem = {
  id: string;
  summary: string;
  start: string;
  end: string;
  state: string;
  type: string;
  url: string;
};

export function ScheduledChangesPanel() {
  const [items, setItems] = useState<ChangeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/changes/today');
        const j = await r.json();
        setItems(Array.isArray(j) ? j : []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <DataCard
      title="Scheduled Changes (Today)"
      icon={Calendar}
      className="lg:col-span-2"
      contentClassName="pt-2"
    >
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) =>
          <Skeleton key={i} className="h-16 w-full" />
        )}</div>
      ) : items.length === 0 ? (
        <div className="text-center text-muted-foreground py-6">
          No changes scheduled today.
        </div>
      ) : (
        <ul className="divide-y">
          {items.map(ch => (
            <li key={ch.id} className="py-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium text-foreground truncate">{ch.summary}</div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(ch.start), 'p')} – {format(new Date(ch.end), 'p')}
                  {' · '}
                  {ch.type || 'Change'} {ch.state ? `(${ch.state})` : ''}
                </div>
              </div>
              <a
                href={ch.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-xs text-primary hover:underline flex-shrink-0"
              >
                View <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </DataCard>
  );
}
