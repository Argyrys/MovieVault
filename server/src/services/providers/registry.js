import NodeCache from 'node-cache';
import { many } from '../../db/pool.js';
import vidsrc from './vidsrc.js';
import vidlink from './vidlink.js';
import autoembed from './autoembed.js';
import vidfast from './vidfast.js';
import vidnest from './vidnest.js';
import vidzee from './vidzee.js';

const MODULES = { vidsrc, vidlink, autoembed, vidfast, vidnest, vidzee };

const configCache = new NodeCache({ stdTTL: 60, useClones: false });
const streamCache = new NodeCache({ stdTTL: 1800, useClones: false });

const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 5 * 60_000;
const failures = new Map();

function circuitOpen(id) {
  const state = failures.get(id);
  return state && state.count >= CIRCUIT_THRESHOLD && Date.now() - state.lastAt < CIRCUIT_COOLDOWN_MS;
}

function recordFailure(id) {
  const state = failures.get(id) || { count: 0, lastAt: 0 };
  state.count += 1;
  state.lastAt = Date.now();
  failures.set(id, state);
}

function recordSuccess(id) {
  failures.delete(id);
}

const DEFAULT_CONFIGS = [
  { id: 'vidnest', name: 'VidNest', type: 'embed', priority: 15 },
  { id: 'vidzee', name: 'Hindi', type: 'direct', priority: 17 },
  { id: 'vidlink', name: 'VidLink', type: 'embed', priority: 20 },
  { id: 'vidfast', name: 'VidFast', type: 'embed', priority: 30 },
  { id: 'autoembed', name: 'AutoEmbed', type: 'embed', priority: 40 },
];

async function getProviderConfigs() {
  const cached = configCache.get('configs');
  if (cached) return cached;
  let rows;
  try {
    rows = await many(
      `SELECT id, name, type, priority FROM providers WHERE enabled = TRUE ORDER BY priority ASC`
    );
  } catch (err) {
    console.warn(`[providers] DB unavailable, using defaults: ${err.message}`);
    rows = DEFAULT_CONFIGS;
  }
  const configs = rows.filter((r) => MODULES[r.id]);
  const missing = rows.filter((r) => !MODULES[r.id]).map((r) => r.id);
  if (missing.length) console.warn(`[providers] enabled but no module: ${missing.join(', ')}`);
  configCache.set('configs', configs);
  return configs;
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`provider timeout after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function getServers({ type, tmdbId, season, episode }) {
  const cacheKey = `stream:${type}:${tmdbId}:${season ?? '-'}:${episode ?? '-'}`;
  const cached = streamCache.get(cacheKey);
  if (cached) return { ...cached, cached: true };

  const configs = await getProviderConfigs();
  const results = await Promise.allSettled(
    configs.map((cfg) => {
      if (circuitOpen(cfg.id)) {
        return Promise.reject(new Error('circuit open'));
      }
      const mod = MODULES[cfg.id];
      return withTimeout(
        Promise.resolve(mod.getStreams({ type, tmdbId, season, episode })),
        8000
      ).then((streams) => {
        recordSuccess(cfg.id);
        return { cfg, streams };
      });
    })
  );

  const servers = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { cfg, streams } = result.value;
      for (const s of streams || []) {
        if (!s || !s.url) continue;
        servers.push({
          id: cfg.id,
          name: cfg.name,
          kind: MODULES[cfg.id].kind,
          priority: cfg.priority,
          ...s,
        });
      }
    } else {
      const idx = results.indexOf(result);
      const cfg = configs[idx];
      if (cfg) {
        recordFailure(cfg.id);
        console.warn(`[providers] ${cfg.id} failed:`, result.reason?.message || result.reason);
      }
    }
  }

  servers.sort((a, b) => a.priority - b.priority);
  const payload = { servers, generated_at: new Date().toISOString() };
  if (servers.length > 0) streamCache.set(cacheKey, payload);
  return payload;
}

export function listProviderModules() {
  return Object.entries(MODULES).map(([id, m]) => ({ id, name: m.name, kind: m.kind }));
}
