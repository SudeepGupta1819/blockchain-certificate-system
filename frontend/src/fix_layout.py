import re

with open('blockchain-certificate-system/frontend/src/App.jsx', 'r', encoding='utf-8') as f:
    app_content = f.read()

layout_pattern = re.compile(r'function Layout\(\{ session, logout, children \}\) \{.*?</aside><main className="min-w-0 flex-1 p-5 sm:p-8"><div className="mx-auto max-w-6xl">\{children\}</div></main></div>;\s*\}', re.DOTALL)

new_layout = """function Layout({ session, logout, children }) {
  const links = [['/dashboard', 'Dashboard'], ['/students', 'Students'], ['/issue', 'Issue Certificate'], ['/certificates', 'Certificates'], ['/verify', 'Verification']];
  const [menuOpen, setMenuOpen] = useState(false);
  const name = session.user?.name || 'Administrator';
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-transparent lg:flex">
      <aside className="border-r border-zinc-800 bg-[#18181b] p-5 lg:min-h-screen lg:w-64">
        <NavLink to="/dashboard" className="mb-7 flex items-center gap-3 text-lg font-bold text-zinc-50">
          <span className="grid h-8 w-8 place-items-center rounded bg-[#34d399] text-zinc-50">🏛️</span>
          CertiChain
        </NavLink>
        <nav className="grid gap-1 sm:grid-cols-2 lg:block">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>{label}</NavLink>
          ))}
        </nav>
      </aside>
      
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex h-16 items-center justify-end px-5 sm:px-8">
          <div className="relative">
            <button 
              onClick={() => setMenuOpen(!menuOpen)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#0c0c0c] border border-zinc-700 text-[#34d399] transition-all duration-200 hover:border-[#34d399] hover:bg-[#112a1f] focus:outline-none"
            >
              <span className="font-bold text-sm">{initial}</span>
            </button>
            
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)}></div>
                <div className="absolute right-0 mt-2 w-56 rounded-lg border border-zinc-800 bg-[#18181b] p-1 shadow-lg z-20">
                  <div className="px-3 py-3 border-b border-zinc-800 mb-1">
                    <p className="truncate text-sm font-medium text-zinc-50">{name}</p>
                    <p className="truncate text-xs text-zinc-400">{session.user?.email}</p>
                  </div>
                  <button 
                    onClick={logout} 
                    className="w-full rounded px-3 py-2 text-left text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-50"
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>
        
        <main className="flex-1 p-5 sm:p-8 pt-0">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}"""

app_content = layout_pattern.sub(new_layout, app_content)

with open('blockchain-certificate-system/frontend/src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(app_content)
