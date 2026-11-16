// The small menu that opens when you click the PageProof icon.
const api = globalThis.browser || globalThis.chrome;
const $ = id => document.getElementById(id);

async function activeTab() {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  return tab;
}
function showError(text) { $('err').textContent = text; $('err').hidden = false; }
const canUse = tab => tab && /^(https?|file):/.test(tab.url || '');
const NOT_HERE = 'PageProof can\'t work on this page. Browser pages (settings, new tab, the add-on store) are protected. Open a normal website and try again.';

async function send(msg) {
  const res = await api.runtime.sendMessage(msg);
  if (res && res.ok === false) throw new Error(res.error);
  return res;
}

$('cap').onclick = async () => {
  const tab = await activeTab();
  try { await api.runtime.sendMessage({ type: 'captureTab', tabId: tab.id }); } catch (e) { /* the capture still starts */ }
  window.close();
};
$('ins').onclick = () => { $('home').hidden = true; $('ways').hidden = false; $('wPick').focus(); };
$('back').onclick = () => { $('ways').hidden = true; $('home').hidden = false; $('err').hidden = true; };

$('wPick').onclick = async () => {
  const tab = await activeTab();
  if (!canUse(tab)) return showError(NOT_HERE);
  try { await send({ type: 'pick', tabId: tab.id }); window.close(); }
  catch (e) { showError('Could not start the picker: ' + e.message); }
};
$('wAll').onclick = async () => {
  const tab = await activeTab();
  if (!canUse(tab)) return showError(NOT_HERE);
  $('wAll').querySelector('small').textContent = 'Looking for pictures...';
  try { await send({ type: 'inspectAll', tabId: tab.id }); window.close(); }
  catch (e) { showError('Could not read the pictures on this page: ' + e.message); }
};
$('wUp').onclick = async () => {
  await api.tabs.create({ url: api.runtime.getURL('inspect.html') });
  window.close();
};
$('stop').onclick = async () => { await api.runtime.sendMessage({ type: 'stop' }); window.close(); };
for (const b of document.querySelectorAll('[data-page]')) b.onclick = async () => { await api.tabs.create({ url: api.runtime.getURL(b.dataset.page) }); window.close(); };
document.addEventListener('click', e => { if (!$('more').contains(e.target)) $('more').open = false; });

(async () => {
  try {
    const st = await api.runtime.sendMessage({ type: 'status' });
    if (st && st.busy) { $('home').hidden = true; $('busy').hidden = false; }
  } catch (e) { /* background asleep: not busy */ }
  // Show the real keyboard shortcut (people can change it).
  try {
    const cmds = await api.commands.getAll();
    const c = cmds.find(x => x.name === 'capture-page');
    const keys = c && c.shortcut;
    if (keys) {
      const tip = $('tip');
      tip.append('Tip: ');
      keys.split('+').forEach((k, i) => { if (i) tip.append('+'); const kb = document.createElement('kbd'); kb.textContent = k; tip.append(kb); });
      tip.append(' captures straight away');
    }
  } catch (e) { /* ignore */ }
})();
