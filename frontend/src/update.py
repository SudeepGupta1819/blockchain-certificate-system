import re

def update_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Layout colors
    content = content.replace('bg-slate-950', 'bg-[#0a0a0a]')
    content = content.replace('bg-slate-900', 'bg-[#111111]')
    content = content.replace('bg-slate-800', 'bg-[#1a1a1a]')
    
    # Text colors
    content = content.replace('text-slate-300', 'text-[#ededed]')
    content = content.replace('text-slate-400', 'text-[#888888]')
    content = content.replace('text-white', 'text-white')
    
    # Borders
    content = content.replace('border-slate-800', 'border-[#2e2e2e]')
    content = content.replace('border-slate-700', 'border-[#2e2e2e]')
    
    # Accent colors
    content = content.replace('bg-blue-600', 'bg-[#24b47e]')
    content = content.replace('text-blue-400', 'text-[#24b47e]')
    content = content.replace('bg-blue-500', 'bg-[#24b47e]')
    
    # Badges
    content = content.replace('bg-emerald-900/40 text-emerald-400', 'bg-[#112a1f] text-[#24b47e]')
    content = content.replace('bg-rose-900/40 text-rose-400', 'bg-[#2a1111] text-[#ef4444]')
    content = content.replace('bg-amber-900/40 text-amber-400', 'bg-[#2a1a11] text-[#f59e0b]')
    
    # Notices
    content = content.replace('border-emerald-900/50 bg-emerald-950/50 text-emerald-400', 'border-[#24b47e]/30 bg-[#112a1f] text-[#24b47e]')
    content = content.replace('border-rose-900/50 bg-rose-950/50 text-rose-400', 'border-[#ef4444]/30 bg-[#2a1111] text-[#ef4444]')

    # Icons / accents
    content = content.replace('text-rose-400', 'text-[#ef4444]')
    content = content.replace('bg-emerald-500', 'bg-[#24b47e]')
    content = content.replace('bg-rose-500', 'bg-[#ef4444]')
    
    # Verify page text replacements
    content = content.replace('text-slate-700', 'text-[#888888]')

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

update_file('blockchain-certificate-system/frontend/src/App.jsx')
update_file('blockchain-certificate-system/frontend/src/VerifyPage.jsx')
