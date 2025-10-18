/**
 * Core utilities for Multiple Entities sharing a single Durable Object class
 * DO NOT MODIFY THIS FILE - You may break the project functionality
 */
import type { ApiResponse } from "@shared/types";
import { DurableObject } from "cloudflare:workers";
// add Worker types so TS knows about KV + DO types
import type {
  KVNamespace,
  DurableObjectNamespace,
  DurableObjectState,
  DurableObjectStub,
} from "@cloudflare/workers-types";

import type { Context } from "hono";

export interface Env {
  // DO binding (already in wrangler.jsonc)
  GlobalDurableObject: DurableObjectNamespace<GlobalDurableObject>;

  // KV binding (matches wrangler.jsonc -> "binding": "KV")
  KV: KVNamespace;

  // ---- Plaintext (optional) envs read by routes ----
  // Feature flag for UI management controls (/api/config, middleware)
  ENABLE_MANAGEMENT?: string;

  // Monitoring Alerts UI overrides / filtering
  SOLARWINDS_UI_BASE?: string;
  SOLARWINDS_EXCLUDE_CAPTIONS?: string;

  // Optional Cloudflare Access headers the SW route supports
  CF_ACCESS_CLIENT_ID?: string;
  CF_ACCESS_CLIENT_SECRET?: string;

  // (Legacy/demo) — safe to keep; not required by current routes
  CROWDSTRIKE_STATUS_URL?: string;
  CITRIX_STATUS_URL?: string;
  FIS_STATUS_URL?: string;
  SECTIGO_STATUS_URL?: string;
  FIVE9_STATUS_URL?: string;
  SOLARWINDS_STATUS_URL?: string;
  SERVICENOW_TICKET_URL_PREFIX?: string;

  // (Legacy/demo) — ServiceNow/SolarWinds creds (current code prefers
  // dynamic keys from your config entity; leaving these is harmless)
  SERVICENOW_USERNAME?: string;
  SERVICENOW_PASSWORD?: string;
  SOLARWINDS_USERNAME?: string;
  SOLARWINDS_PASSWORD?: string;

  // Allow additional keys (you use dynamic c.env[cfg.usernameVar], etc.)
  [k: string]: any;
}
