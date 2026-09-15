// Lets the coach answer member questions that fall outside MedFit's own
// internal knowledge (lib/framework.js, lib/resources.js) — e.g. "is it
// safe to drink coffee on this program" or "what does GLP-1 do to your
// appetite" — by searching the live web, per James's direction:
//   1. Try a curated allowlist of trusted health/fitness sources first.
//   2. Only fall back to the open web if the allowlist turns up nothing.
// Needs SERPER_API_KEY (serper.dev) — without it, callers get
// { ok: false } and should say plainly that live lookup isn't configured.

const TRUSTED_HEALTH_DOMAINS = [
  'mayoclinic.org',
  'clevelandclinic.org',
  'health.harvard.edu',
  'hopkinsmedicine.org',
  'nih.gov',
  'cdc.gov',
  'medlineplus.gov',
  'acefitness.org',
  'fattyliverfoundation.org',
];

async function serperSearch(q) {
  const key = process.env.SERPER_API_KEY;
  if (!key) return null;
  const resp = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q }),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  return (data.organic || []).slice(0, 5).map((r) => ({ title: r.title, snippet: r.snippet, url: r.link }));
}

// Two-tier lookup: trusted allowlist first, open web only if that comes up
// empty. Returns { ok, tier: 'trusted'|'open', results } or { ok: false }.
async function lookupExternalKnowledge(query) {
  if (!process.env.SERPER_API_KEY) {
    return { ok: false, reason: 'SERPER_API_KEY not configured — live lookup unavailable in this deployment.' };
  }

  const siteFilter = TRUSTED_HEALTH_DOMAINS.map((d) => `site:${d}`).join(' OR ');
  const trusted = await serperSearch(`${query} (${siteFilter})`);
  if (trusted && trusted.length) {
    return { ok: true, tier: 'trusted', results: trusted };
  }

  const open = await serperSearch(query);
  if (open && open.length) {
    return { ok: true, tier: 'open', results: open };
  }

  return { ok: false, reason: 'No relevant results found.' };
}

module.exports = { lookupExternalKnowledge, TRUSTED_HEALTH_DOMAINS };
