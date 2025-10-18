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
  sys_id?: string;
  number?: string;
  [k: string]: any;
};

function coerceArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.result)) return payload.result; // raw ServiceNow
  if (payload && Array.isArray(payload.items)) return payload.items;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

function asText(v: any): string {
  if (v == null) return '';
  if (typeof v === 'object') {
    // ServiceNow display objects
    if ('display_value' in v) return String((v as any).display_value ?? '');
    if ('value' in v) return String((v as any).value ?? '');
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
}

function normDateStr(v?: any): string | null {
  const s = asText(v).trim();
  if (!s) return null;
  // turn "YYYY-MM-DD hh:mm:ss" into ISO-ish "YYYY-MM-DDThh:mm:ss"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return s.replace(' ', 'T');
  return s; // let Date try (also handles real ISO)
}

function safeParse(v?: any): Date | null {
  const n = normDateStr(v);
  if (!n) return null;
  const d = new Date(n);
  return isNaN(d.getTime()) ? null : d;
}

function safeTime(d: Date | null): string {
  try { return d ? format(d, 'p') : '—'; } catch { return '—'; }
}

function isCancelled(state: unknown): boolean {
  const s = asText(state).toLowerCase();
  return s.includes('cancel'); // “Canceled/Cancelled”
}

function buildUrl(row: any): string | null {
  if (row.url) return asText(row.url);
  if (row.sys_id && row.instance_base_url) {
    return `${row.instance_base_url}/nav_to.do?uri=change_request.do?sys_id=${row.sys_id}`;
  }
  return null;
}

export function ScheduledChangesPanel() {
  const [items, setItems] = useState<ChangeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const r = await fetch('/api/changes/today');
        if (!r.ok) {
          setErrorMsg(`API returned ${r.status}`);
          setItems([]);
          return;
        }
        const payload = await r.json();
        const rows = coerceArray(payload)
          .map((row: any): ChangeItem => {
            const start = row.start ?? row.start_date ?? row.planned_start_date ?? row.window_start ?? null;
            const end   = row.end   ?? row.end_date   ?? row.planned_end_date   ?? row.window_end   ?? null;

            return {
              id: asText(row.id ?? row.sys_id ?? row.number ?? `${row.sys_id || ''}:${row.number || ''}`),
              summary: asText(row.summary ?? row.short_description ?? row.description ?? '(no summary)'),
              start,
              end,
              state: asText(row.state ?? row.status ?? ''),
              type: asText(row.type ?? row.change_type ?? ''),
              url: buildUrl(row),
              sys_id: asText(row.sys_id ?? ''),
              number: asText(row.number ?? ''),
              ...row,
            };
          })
          .filter((row: ChangeItem) => !isCancelled(row.state))
          .filter((row: ChangeItem) => {
            // Show things relevant to *today* even if dates are missing
            const ds = safeParse(row.start);
            const de = safeParse(row.end);
            if (!ds && !de) return true;

            const now = new Date();
            const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            const dayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

            if (ds && de) return ds <= dayEnd && de >= dayStart; // window overlaps today
            if (ds && !de) return ds <= dayEnd;                   // started today or earlier
            if (!ds && de) return de >= dayStart;                 // ends today
            return true;
          });

        setItems(rows);
      } catch (e) {
        console.error('Failed to load /api/changes/today', e);
        setErrorMsg('Failed to load changes.');
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
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) =>
          <Skeleton key={i} className="h-16 w-full" />
        )}</div>
      ) : errorMsg ? (
        <div className="text-center text-destructive py-6">{errorMsg}</div>
      ) : items.length === 0 ? (
        <div className="text-center text-muted-foreground py-6">
          No changes scheduled today.
        </div>
      ) : (
        <ul className="divide-y">
          {items.map(ch => {
            const dStart = safeParse(ch.start);
            const dEnd = safeParse(ch.end);
            return (
              <li key={ch.id} className="py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate">
                    {asText(ch.summary)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {safeTime(dStart)} – {safeTime(dEnd)}
                    {' · '}
                    {asText(ch.type) || 'Change'} {ch.state ? `(${asText(ch.state)})` : ''}
                  </div>
                </div>
                {ch.url ? (
                  <a
                    href={asText(ch.url)}
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
