// One self-contained copy of the "Verify a pack" page, placed inside every evidence pack
// so anyone can double-click it to check the pack, even without PageProof.
async function standaloneChecker() {
  const text = async f => (await fetch(f)).text();
  let html = await text('verify.html');
  const icon = await (await fetch('icons/icon48.png')).blob();
  const iconUrl = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(icon); });
  const inline = async f => '<script>\n' + (await text(f)).replace(/<\/script/gi, '<\\/script') + '\n</script>';
  const css = await text('viewer.css');
  html = html.replace('<link rel="stylesheet" href="viewer.css">', () => '<style>\n' + css + '\n</style>');
  const look = (await text('ui/tools-look.css')).replace(/@font-face\{[^}]*\}/, '');
  html = html.replace('<link rel="stylesheet" href="ui/tools-look.css">', () => '<style>\n' + look + '\n</style>');
  html = html.replace('<link rel="icon" href="icons/icon32.png">', () => '<link rel="icon" href="' + iconUrl + '">');
  html = html.replace('src="icons/icon48.png"', () => 'src="' + iconUrl + '"');
  html = html.replace(/<a class="link" href="(log|markup)\.html"[^>]*>[^<]*<\/a>/g, '');
  // The pack's own copy keeps its plain look: the app-only look (calm) is left out of it.
  html = html.replace(/<link rel="stylesheet" href="ui\/calm-[a-z]+\.css">\n?/g, '').replace(/ *<script src="ui\/(tool-kit|verify-calm)\.js"><\/script>\n?/g, '');
  const themeJs = await inline('theme.js');
  html = html.replace('<script src="theme.js"></script>', () => '<script>window.PP_STANDALONE = true;</script>\n' + themeJs);
  for (const f of ['unzip.js', 'tsverify.js', 'verify.js']) { const js = await inline(f); html = html.replace('<script src="' + f + '"></script>', () => js); }
  html = html.replace('Check that an evidence pack hasn\'t been changed since it was made', 'Check that this evidence pack hasn\'t been changed since it was made. Nothing leaves your computer.');
  return html;
}
