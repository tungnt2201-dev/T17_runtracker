import re, subprocess, sys, zipfile, shutil, os
from xml.sax.saxutils import escape
src, lo_pdf, out = sys.argv[1:4]
txt = subprocess.run(['pdftotext', '-f', '2', '-l', '2', '-layout', lo_pdf, '-'], capture_output=True, text=True).stdout
entries = []
for line in txt.splitlines():
    m = re.match(r'^(\s*)(.+?)\.{3,}\s*(\d+)\s*$', line)
    if m: entries.append((2 if len(m.group(1)) >= 2 else 1, m.group(2).strip(), m.group(3)))
assert len(entries) > 20, entries
W = 9638
def para(level, text, page, first=False, last=False):
    ind = 0 if level == 1 else 400
    rpr = '<w:rPr><w:b/><w:bCs/></w:rPr>' if level == 1 else ''
    s = f'<w:p><w:pPr><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="{W}"/></w:tabs><w:spacing w:before="{80 if level==1 else 0}" w:after="40"/><w:ind w:left="{ind}"/></w:pPr>'
    if first: s += '<w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r><w:r><w:instrText xml:space="preserve">TOC \\h \\o &quot;1-2&quot;</w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>'
    s += f'<w:r>{rpr}<w:t xml:space="preserve">{escape(text)}</w:t></w:r><w:r>{rpr}<w:tab/></w:r><w:r>{rpr}<w:t>{page}</w:t></w:r>'
    if last: s += '<w:r><w:fldChar w:fldCharType="end"/></w:r>'
    return s + '</w:p>'
body = ''.join(para(l, t, p, i == 0, i == len(entries) - 1) for i, (l, t, p) in enumerate(entries))
tmp = out + '.dir'; shutil.rmtree(tmp, ignore_errors=True)
with zipfile.ZipFile(src) as z: z.extractall(tmp)
dp = os.path.join(tmp, 'word', 'document.xml'); s = open(dp, encoding='utf8').read()
pat = re.compile(r'<w:sdtContent><w:p><w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/><w:instrText xml:space="preserve">TOC .*?</w:sdtContent>', re.S)
assert len(pat.findall(s)) == 1
s = pat.sub(lambda m: '<w:sdtContent>' + body + '</w:sdtContent>', s)
s = s.replace('Nếu mục lục chưa hiện số trang: trong Word bấm chuột phải vào mục lục → ', 'Khi Word hỏi cập nhật trường (Update fields) lúc mở file, chọn Yes để số trang chính xác. Hoặc bấm chuột phải vào mục lục → ')
open(dp, 'w', encoding='utf8').write(s)
if os.path.exists(out): os.remove(out)
with zipfile.ZipFile(src) as zi, zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zo:
    for info in zi.infolist():
        data = open(os.path.join(tmp, info.filename), 'rb').read() if not info.is_dir() else b''
        zo.writestr(info, data)
shutil.rmtree(tmp); print('entries', len(entries))
