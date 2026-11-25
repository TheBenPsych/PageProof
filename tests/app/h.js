const { chromium } = require('playwright');
// Starts a real browser with PageProof loaded, for the checks in this folder.
const path = require('path').resolve(__dirname, '../../extension');
exports.start = async (opts = {}) => {
  const ctx = await chromium.launchPersistentContext('', { headless: false, args: ['--headless=new', `--disable-extensions-except=${path}`, `--load-extension=${path}`, '--no-sandbox'], viewport: { width: 1440, height: 900 }, ...opts });
  let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker', { timeout: 15000 });
  const id = sw.url().split('/')[2];
  // Site gone check: the pretend sites all "exist" unless a check says otherwise (never asks the real DNS).
  await ctx.route('https://dns.google/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ Status: (exports.goneHosts || []).some(h => r.request().url().includes('name=' + encodeURIComponent(h))) ? 3 : 0 }) }));
  return { ctx, sw, id, url: p => `chrome-extension://${id}/${p}` };
};
