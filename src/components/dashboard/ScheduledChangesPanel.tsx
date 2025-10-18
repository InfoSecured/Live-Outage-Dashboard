import { useEffect, useState } from 'react';
import { DataCard } from './DataCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

type ChangeItem = {
  id: string;
  summary: string;
  start?: string | null;
  end?: string | null;
  state?: string | number | null;
  type?: string | null;
  url?: string | null;
  // allow passthrough unknown fields from API
  [k: string]: any;
};

function coerceArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && Array.isArray(payload.result)) return payload.result;   // ServiceNow default
  if (payload && Array.isArray(payload.results)) return payload.results; // some wrappers
  return [];
}

function toIsoLike(v?: string | null): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  // Already ISO?
  if (s.includes('T')) return s;
  // Convert "YYYY-MM-DD hh:mm:ss" -> "YYYY-MM-DDThh:mm:ss"
  // (no trailing Z so it stays in local time)
  return s.replace(' ', 'T');
}

function looksCancelled(state: unknown): boolean {
  if (state == null) return false;
  const s = String(state).toLowerCase();
  // Works for both display ("Canceled"/"Cancelled") and numeric enums we don't fully map yet
  return s.includes('cancel');
}

function buildSnUrl(row: any): string | null {
  if (row.url) return row.url;
  if (row.sys_id && row.instance_base_url) {
    // If your API ever sends instance_base_url, use it:
    return `${row.instance_base_url}/nav_to.do?uri=change_request.do?sys_id=${row.sys_id}`;
  }
  return null;
}

export function ScheduledChangesPanel() {
  const [items, setItems] = useState<ChangeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/changes/today');
        const j = await r.json();

        // Accept multiple shapes and map to our UI model
        const rows = coerceArray(j)
          .map((row: any): ChangeItem => {
            // tolerate various field names from the API layer
            const start =
              row.start ??
              row.start_date ??
              row.planned_start_date ??
              row.window_start ??
              null;

            const end =
              row.end ??
              row.end_date ??
              row.planned_end_date ??
              row.window_end ??
              null;

            return {
              id: row.id ?? row.sys_id ?? row.number ?? crypto.randomUUID(),
              summary:
                row.summary ??
                row.short_description ??
                row.description ??
                '(no summary)',
              start: toIsoLike(start),
              end: toIsoLike(end),
              state: row.state ?? row.status ?? null,
              type: row.type ?? row.change_type ?? null,
              url: buildSnUrl(row),
              ...row,
            };
          })
          // hide cancelled
          .filter((row: ChangeItem) => !looksCancelled(row.state))
          // show things that overlap "today" OR explicitly start/end today
          // (API already tries to do this, but this keeps the UI resilient)
          .filter((row: ChangeItem) => {
            // if we don't have dates, keep it (don’t hide useful entries)
            if (!row.start && !row.end) return true;
            const now = new Date();
            const start = row.start ? new Date(row.start) : null;
            const end = row.end ? new Date(row.end) : null;

            const dayStart = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
              0, 0, 0, 0
            );
            const dayEnd = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
              23, 59, 59, 999
            );

            // Overlap logic: [start, end] intersects [dayStart, dayEnd]
            if (start && end) return start <= dayEnd && end >= dayStart;
            if (start && !end) return start <= dayEnd; // started today or before and ongoing
            if (!start && end) return end >= dayStart; // ends today
            return true;
          });

        setItems(rows);
      } catch (err) {
        console.error('Failed to load changes:', err);
        setItems([]);
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
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center text-muted-foreground py-6">
          No changes scheduled today.
        </div>
      ) : (
        <ul className="divide-y">
          {items.map((ch) => {
            const start = ch.start ? new Date(ch.start) : null;
            const end = ch.end ? new Date(ch.end) : null;

            return (
              <li key={ch.id} className="py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate">
                    {ch.summary}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {start ? format(start, 'p') : '—'} – {end ? format(end, 'p') : '—'}
                    {' · '}
                    {(ch.type || 'Change')}{' '}
                    {ch.state ? `(${String(ch.state)})` : ''}
                  </div>
                </div>
                {ch.url ? (
                  <a
                    href={ch.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center text-xs text-primary hover:underline flex-shrink-0"
                  >
                    View <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </DataCard>
  );
}
