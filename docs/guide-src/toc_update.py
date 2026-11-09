import sys, time, subprocess, os
sys.path.insert(0, '/root/.claude/skills/synced/a24499f3-fc31-40c4-8f14-554b8a4bc79e_c1fd2c1e-8902-4a99-bbf5-ab6b5282906e/docx/scripts/office')
from soffice import get_soffice_env
import uno
from com.sun.star.beans import PropertyValue
src, dst = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
prof = 'file:///tmp/claude-0/-home-claude/ce926691-120b-59c3-822f-8cfc96059712/scratchpad/lo_profile'
p = subprocess.Popen(['soffice', '--headless', '--invisible', '--norestore', f'-env:UserInstallation={prof}', '--accept=socket,host=127.0.0.1,port=2002;urp;'], env=get_soffice_env(), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
ctx = None
local = uno.getComponentContext(); resolver = local.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver', local)
for i in range(60):
    try: ctx = resolver.resolve('uno:socket,host=127.0.0.1,port=2002;urp;StarOffice.ComponentContext'); break
    except Exception: time.sleep(1)
def pv(n, v): x = PropertyValue(); x.Name = n; x.Value = v; return x
desktop = ctx.ServiceManager.createInstanceWithContext('com.sun.star.frame.Desktop', ctx)
doc = desktop.loadComponentFromURL(uno.systemPathToFileUrl(src), '_blank', 0, (pv('Hidden', True),))
idx = doc.getDocumentIndexes(); print('indexes', idx.getCount())
for i in range(idx.getCount()): idx.getByIndex(i).update()
doc.refresh() if hasattr(doc, 'refresh') else None
doc.storeToURL(uno.systemPathToFileUrl(dst), (pv('FilterName', 'MS Word 2007 XML'),))
doc.storeToURL(uno.systemPathToFileUrl(dst.replace('.docx', '.pdf')), (pv('FilterName', 'writer_pdf_Export'),))
doc.close(True)
try: desktop.terminate()
except Exception: pass
p.wait(timeout=20); print('ok')
