import { useEffect, useState } from 'react';
import { DataCard } from './DataCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

type Props = {
  managementEnabled?: boolean;
  refreshTick?: number; // NEW
};

type ChangeItem = {
  id: string;
  summary: string;
  offering?: string;
  start?: string | null;
  end?: string | null;
  state?: string | number | null;
  type?: string | null;
  url?: string | null;
  sys_id?: string;
  number?: string;
  __isHot?: boolean;
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
    if ('display_value' in v) return String((v as any).display_value ?? '');
    if ('value' in v) return String((v as any).value ?? '');
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
}

function normDateStr(v?: any): string | null {
  const s = asText(v).trim();
  if (!s) return null;
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

function isAllowedState(state: unknown): boolean {
  const s = asText(state).toLowerCase();
  // allow Scheduled / Implement / Review (matches label or numeric label text)
  return ['scheduled', 'implement', 'review'].some((w) => s.includes(w));
}

function buildUrl(row: any): string | null {
  if (row.url) return asText(row.url);
  if (row.sys_id && row.instance_base_url) {
    return `${row.instance_base_url}/nav_to.do?uri=change_request.do?sys_id=${row.sys_id}`;
  }
  return null;
}

export function ScheduledChangesPanel({ managementEnabled, refreshTick }: Props) {
  const [items, setItems] = useState<ChangeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const [rChanges, rOutages] = await Promise.all([
          fetch('/api/changes/today'),
          fetch('/api/outages/active'),
        ]);

        if (!rChanges.ok) {
          setErrorMsg(`API returned ${rChanges.status}`);
          setItems([]);
          return;
        }

        const payload = await rChanges.json();
        const outagesPayload = rOutages.ok ? await rOutages.json() : { data: [] };

        const outageRows = coerceArray(outagesPayload?.data ?? outagesPayload); // handle ApiResponse or raw
        const hotOfferings = new Set(
          outageRows
            .map((o: any) =>
              asText(o?.offering ?? o?.service_offering ?? '')
                .trim()
                .toLowerCase()
            )
            .filter(Boolean)
        );

        const rows = coerceArray(payload)
          .map((row: any): ChangeItem => {
            const start = row.start ?? row.start_date ?? row.planned_start_date ?? row.window_start ?? null;
            const end   = row.end   ?? row.end_date   ?? row.planned_end_date   ?? row.window_end   ?? null;
            const offering = asText(row.offering ?? row.service_offering ?? '').trim();

            return {
              id: asText(row.id ?? row.sys_id ?? row.number ?? `${row.sys_id || ''}:${row.number || ''}`),
              number: asText(row.number ?? ''),
              summary: asText(row.summary ?? row.short_description ?? row.description ?? '(no summary)'),
              offering,
              start,
              end,
              state: asText(row.state ?? row.status ?? ''),
              type: asText(row.type ?? row.change_type ?? ''),
              url: buildUrl(row),
              sys_id: asText(row.sys_id ?? ''),
              __isHot: offering ? hotOfferings.has(offering.toLowerCase()) : false,
              ...row,
            };
          })
          .filter((row: ChangeItem) => !isCancelled(row.state))
          .filter((row: ChangeItem) => isAllowedState(row.state))
          .filter((row: ChangeItem) => {
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
          })
          .sort((a, b) => {
            const da = safeParse(a.start);
            const db = safeParse(b.start);
            if (da && db) return da.getTime() - db.getTime();
            if (da && !db) return -1;
            if (!da && db) return 1;
            return 0;
          });

        setItems(rows);
      } catch (e) {
        console.error('Failed to load changes/outages', e);
        setErrorMsg('Failed to load changes.');
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const [rChanges, rOutages] = await Promise.all([
          fetch('/api/changes/today', { signal: ac.signal }),
          fetch('/api/outages/active', { signal: ac.signal }),
        ]);
        // ...existing parsing...
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          console.error('Failed to load changes/outages', e);
          setErrorMsg('Failed to load changes.');
          setItems([]);
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [refreshTick]); // <— trigger on tick
  
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
      ) : errorMsg ? (
        <div className="text-center text-destructive py-6">{errorMsg}</div>
      ) : items.length === 0 ? (
        <div className="text-center text-muted-foreground py-6">
          No changes scheduled today.
        </div>
      ) : (
        <ul className="divide-y">
          {items.map((ch) => {
            const dStart = safeParse(ch.start);
            const dEnd = safeParse(ch.end);
            const isHot = Boolean(ch.__isHot);

            return (
              <li
                key={ch.id}
                data-hot={isHot || undefined}
                className={`py-3 flex items-start justify-between gap-4 pl-3 border-l-4 ${
                  isHot ? 'border-red-500/80' : 'border-transparent'
                }`}
                aria-label={isHot ? 'Scheduled change overlaps an active outage' : undefined}
                title={isHot ? 'This change matches a service with an active outage' : undefined}
              >
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate flex items-center gap-2">
                    {isHot && (
                      <span
                        className="relative inline-flex items-center"
                        aria-hidden="true"
                      >
                        <span className="h-2 w-2 rounded-full bg-red-500"></span>
                        <span className="absolute inline-flex h-2 w-2 rounded-full bg-red-500 opacity-75 animate-ping"></span>
                      </span>
                    )}
                    <span className="truncate">
                      {(ch.number ? ch.number + ' — ' : '') +
                        (ch.offering ? ch.offering + ' — ' : '') +
                        (ch.summary || '')}
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>
                      {safeTime(dStart)} – {safeTime(dEnd)}
                      {' · '}
                      {asText(ch.type) || 'Change'}{' '}
                      {ch.state ? (
                        <span className={/emergency/i.test(asText(ch.type)) ? 'text-red-600 dark:text-red-400' : ''}>
                          ({asText(ch.state)})
                        </span>
                      ) : null}
                    </span>

                    {isHot && (
                      <span
                        className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                        title="Active outage for this service"
                      >
                        Active outage
                      </span>
                    )}
                  </div>
                </div>

                {ch.url ? (
                  <a
                    href={asText(ch.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center text-xs text-primary hover:underline flex-shrink-0"
                    title="Open in ServiceNow"
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
