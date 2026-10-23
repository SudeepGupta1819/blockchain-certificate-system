import re

# UPDATE APP.JSX
with open('blockchain-certificate-system/frontend/src/App.jsx', 'r', encoding='utf-8') as f:
    app_content = f.read()

# Remove Demo Checklist from Dashboard
dashboard_pattern = re.compile(r'<div className="card mt-6"><h2 className="text-lg font-bold text-zinc-50">Demo checklist</h2>.*?</div>')
app_content = dashboard_pattern.sub('', app_content)

with open('blockchain-certificate-system/frontend/src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(app_content)

# UPDATE VERIFYPAGE.JSX
with open('blockchain-certificate-system/frontend/src/VerifyPage.jsx', 'r', encoding='utf-8') as f:
    vp_content = f.read()

# Replace the nav bar
nav_pattern = re.compile(r'<nav className="flex items-center justify-between border-b border-zinc-800 bg-\[#0c0c0c\] px-6 py-4">.*?</nav>', re.DOTALL)

new_nav = """<nav className="flex items-center border-b border-zinc-800 bg-[#0c0c0c] px-6 py-4">
        <NavLink to="/login" className="text-zinc-400 hover:text-zinc-100 flex items-center gap-2 transition-colors text-sm font-medium mr-6">
          <span aria-hidden="true">←</span> Back to Portal
        </NavLink>
        <div className="h-6 w-px bg-zinc-800 mr-6 hidden sm:block"></div>
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded bg-[#34d399] text-zinc-50">
            🏛️
          </div>
          <span className="font-bold tracking-tight text-zinc-50 hidden sm:inline">CertiChain</span>
          <span className="text-zinc-600 hidden sm:inline">/</span>
          <span className="text-zinc-400 text-sm font-medium">Public Verification</span>
        </div>
      </nav>"""

vp_content = nav_pattern.sub(new_nav, vp_content)

with open('blockchain-certificate-system/frontend/src/VerifyPage.jsx', 'w', encoding='utf-8') as f:
    f.write(vp_content)
