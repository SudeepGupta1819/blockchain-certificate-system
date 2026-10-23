import re

with open('blockchain-certificate-system/frontend/src/App.jsx', 'r', encoding='utf-8') as f:
    app_content = f.read()

old_account = r'<div className="mt-7 border-t border-zinc-800 pt-5 text-sm"><p className="truncate font-medium text-zinc-50">{session\.user\?\.name \|\| \'Administrator\'}</p><p className="truncate text-zinc-400">{session\.user\?\.email}</p><button onClick={logout} className="mt-4 font-semibold text-\[#34d399\] hover:underline">Sign out</button></div>'

new_account = """<div className="mt-7 border-t border-zinc-800 pt-5">
          <div className="flex items-center gap-3 mb-4 group cursor-pointer">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#0c0c0c] border border-zinc-700 text-[#34d399] transition-all duration-200 group-hover:border-[#34d399] group-hover:bg-[#112a1f]">
              <span className="font-bold text-sm">A</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-50">{session.user?.name || 'Administrator'}</p>
              <p className="truncate text-xs text-zinc-400">{session.user?.email}</p>
            </div>
          </div>
          <button onClick={logout} className="w-full rounded border border-zinc-800 bg-transparent py-1.5 text-xs font-semibold text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100">Sign out</button>
        </div>"""

app_content = re.sub(old_account, new_account, app_content)

with open('blockchain-certificate-system/frontend/src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(app_content)
