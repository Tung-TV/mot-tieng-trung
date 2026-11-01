# Cố định giao diện sáng: bỏ mọi khối @media (prefers-color-scheme:dark){…} và luật [data-theme="dark"] khỏi file CSS/HTML.
# Dùng: python3 scripts/light-only.py <file> [file…]
import re, sys

def block_end(s, i):  # i = vị trí '{'; trả về vị trí sau '}' tương ứng
    d = 0
    for j in range(i, len(s)):
        if s[j] == '{': d += 1
        elif s[j] == '}':
            d -= 1
            if d == 0: return j + 1
    return len(s)

def strip(s):
    out, i = [], 0
    pat = re.compile(r'@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)\s*\{|[^{};]*\[data-theme="dark"\][^{};]*\{')
    while True:
        m = pat.search(s, i)
        if not m: out.append(s[i:]); break
        out.append(s[i:m.start()])
        i = block_end(s, m.end() - 1)
    return ''.join(out)

for f in sys.argv[1:]:
    s = open(f, encoding='utf-8').read(); t = strip(s)
    if t != s: open(f, 'w', encoding='utf-8').write(t); print(f, len(s) - len(t), 'ký tự bỏ')
