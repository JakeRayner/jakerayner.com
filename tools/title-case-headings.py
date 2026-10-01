#!/usr/bin/env python3
"""Title Case every h1 to h6 on the portfolio pages (asked for, October 2026).

Minor words (articles, short conjunctions and prepositions) stay lowercase
unless first, last or straight after a colon. Words that already carry a
capital (UX, BMB, iOS) and brand names styled in lowercase (bet365) are
left alone; each part of a hyphenated word is capitalised. Only text
outside tags is touched. Run from the repo root; it is safe to rerun."""
import re, sys
PAGES = ['index.html', 'about.html'] + [f'work/{p}.html' for p in
         ['aston-martin', 'bentley-motors', 'debenhams', 'co-operative-bank', 'bet365', 'barclays']]
MINOR = {'a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'as', 'at', 'by', 'in', 'of', 'on',
         'to', 'with', 'from', 'into', 'via', 'vs'}
KEEP = {'bet365', 'boohoo', 'boohooman', 'ios'}

def cap(word):
    return '-'.join(p[:1].upper() + p[1:] if p[:1].islower() else p for p in word.split('-'))

def title(text, first_in_heading, last_in_heading):
    tokens = re.split(r'(\s+)', text)
    words = [i for i, t in enumerate(tokens) if t.strip()]
    after_colon = False
    for n, i in enumerate(words):
        w = tokens[i]
        core = re.sub(r'^[^\w]+|[^\w]+$', '', w)
        lead = w[:len(w) - len(w.lstrip('"\'(“‘'))]
        is_first = (n == 0 and first_in_heading) or after_colon
        is_last = n == len(words) - 1 and last_in_heading
        after_colon = w.endswith(':')
        if not core or core.lower() in KEEP or ('-' not in core and any(c.isupper() for c in core)):
            continue
        if core.lower() in MINOR and not is_first and not is_last:
            continue
        body = w[len(lead):]
        tokens[i] = lead + cap(body)
    return ''.join(tokens)

def fix_heading(m):
    open_tag, inner, close = m.group(1), m.group(2), m.group(3)
    parts = re.split(r'(<[^>]+>)', inner)
    texts = [i for i, p in enumerate(parts) if p and not p.startswith('<') and p.strip()]
    for k, i in enumerate(texts):
        parts[i] = title(parts[i], k == 0, k == len(texts) - 1)
    return open_tag + ''.join(parts) + close

changed = 0
for page in (sys.argv[1:] or PAGES):
    s = open(page, encoding='utf-8').read()
    out = re.sub(r'(<h[1-6]\b[^>]*>)(.*?)(</h[1-6]>)', fix_heading, s, flags=re.S)
    if out != s:
        open(page, 'w', encoding='utf-8').write(out); changed += 1
print(f'{changed} pages changed')
