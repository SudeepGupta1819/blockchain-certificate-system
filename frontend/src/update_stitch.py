import re

def update_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Layout colors
    content = content.replace('bg-[#0a0a0a]', 'bg-transparent') # Because index.css handles the body bg with grid
    content = content.replace('bg-[#111111]', 'bg-[#18181b]')
    content = content.replace('bg-[#1a1a1a]', 'bg-[#27272a]')
    
    # Text colors
    content = content.replace('text-[#ededed]', 'text-zinc-300')
    content = content.replace('text-[#888888]', 'text-zinc-400')
    content = content.replace('text-white', 'text-zinc-50')
    
    # Borders
    content = content.replace('border-[#2e2e2e]', 'border-zinc-800')
    
    # Accent colors
    content = content.replace('bg-[#24b47e]', 'bg-[#34d399]')
    content = content.replace('text-[#24b47e]', 'text-[#34d399]')
    
    # Badges (matching Stitch style - solid dark backgrounds with clear text)
    content = content.replace('bg-[#112a1f] text-[#24b47e]', 'border border-[#064e3b] bg-[#022c22] text-[#34d399]')
    content = content.replace('bg-[#2a1111] text-[#ef4444]', 'border border-[#7f1d1d] bg-[#450a0a] text-[#f87171]')
    content = content.replace('bg-[#2a1a11] text-[#f59e0b]', 'border border-[#78350f] bg-[#451a03] text-[#fbbf24]')
    
    # Verify page text replacements
    content = content.replace('text-slate-300', 'text-zinc-300')

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

update_file('blockchain-certificate-system/frontend/src/App.jsx')
update_file('blockchain-certificate-system/frontend/src/VerifyPage.jsx')
