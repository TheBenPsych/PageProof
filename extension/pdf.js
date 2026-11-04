// A tiny PDF maker: puts one JPEG picture on each page. No outside libraries needed.
function makePdf(pages, info) {
  const enc = new TextEncoder();
  const chunks = [];
  const offsets = [];
  let length = 0;
  const add = part => {
    const bytes = typeof part === 'string' ? enc.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const pdfText = s => '(' + String(s).replace(/[^\x20-\x7e]/g, '?').replace(/([\\()])/g, '\\$1') + ')';
  const obj = (num, body) => { offsets[num] = length; add(num + ' 0 obj\n'); body(); add('\nendobj\n'); };

  const pageW = 595.28; // A4 width in points
  const n = pages.length;
  const infoNum = 3 + n * 3;
  add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, () => add('<< /Type /Catalog /Pages 2 0 R >>'));
  const kids = pages.map((_, i) => (3 + i * 3) + ' 0 R').join(' ');
  obj(2, () => add('<< /Type /Pages /Kids [' + kids + '] /Count ' + n + ' >>'));

  pages.forEach((p, i) => {
    const pageNum = 3 + i * 3, contentNum = pageNum + 1, imgNum = pageNum + 2;
    const pageH = +(p.height * pageW / p.width).toFixed(2);
    obj(pageNum, () => add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pageW + ' ' + pageH + '] ' +
      '/Resources << /XObject << /Im0 ' + imgNum + ' 0 R >> >> /Contents ' + contentNum + ' 0 R >>'));
    const draw = 'q ' + pageW + ' 0 0 ' + pageH + ' 0 0 cm /Im0 Do Q';
    obj(contentNum, () => add('<< /Length ' + draw.length + ' >>\nstream\n' + draw + '\nendstream'));
    obj(imgNum, () => {
      add('<< /Type /XObject /Subtype /Image /Width ' + p.width + ' /Height ' + p.height +
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + p.jpeg.length + ' >>\nstream\n');
      add(p.jpeg);
      add('\nendstream');
    });
  });

  obj(infoNum, () => add('<< /Title ' + pdfText(info.title) + ' /Subject ' + pdfText(info.subject) +
    ' /Producer (PageProof) >>'));

  const xrefAt = length;
  let xref = 'xref\n0 ' + (infoNum + 1) + '\n0000000000 65535 f \n';
  for (let i = 1; i <= infoNum; i++) xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  add(xref + 'trailer\n<< /Size ' + (infoNum + 1) + ' /Root 1 0 R /Info ' + infoNum + ' 0 R >>\nstartxref\n' + xrefAt + '\n%%EOF\n');
  return new Blob(chunks, { type: 'application/pdf' });
}
