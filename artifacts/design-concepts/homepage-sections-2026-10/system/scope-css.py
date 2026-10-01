#!/usr/bin/env python3
"""Scope mock CSS for the app: .de-* -> .v7-*, --de-* -> --v7-*, :root/body -> .v7,
every selector prefixed with `.v7 ` (or `.v7` for root-level), @font-face and html/
element resets dropped (the site already self-hosts the fonts and runs preflight).
Usage: scope-css.py <in.css or in.html> > out.css   (for .html, the first <style> block)."""
import re, sys

def tokenize(css):
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    out, i, depth, start = [], 0, 0, 0
    return css

def split_rules(css):
    """Yield (prelude, body) at top level; body may contain nested rules (for @media)."""
    i, n = 0, len(css)
    while i < n:
        j = css.find('{', i)
        if j == -1: break
        prelude = css[i:j].strip()
        depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == '{': depth += 1
            elif css[k] == '}': depth -= 1
            k += 1
        yield prelude, css[j+1:k-1]
        i = k

ROOTISH = {':root', 'body', 'html'}
DROP_SEL = re.compile(r'^(\*|\*::before|\*::after|html|img|svg|a|button|h[1-4]|p|ul|ol)$')

def scope_selector(sel):
    sel = sel.strip()
    if sel in ROOTISH: return '.v7'
    if DROP_SEL.match(sel): return None
    if sel.startswith('body '): sel = sel[5:]
    if sel.startswith('html '): sel = sel[5:]
    return '.v7 ' + sel

def rename(s):
    s = s.replace('--de-', '--v7-').replace('--radius-', '--v7-radius-').replace('--font-', '--v7-font-')
    s = re.sub(r'\.de-([a-z0-9])', r'.v7-\1', s)
    return s

def convert(css, indent=''):
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    out = []
    for prelude, body in split_rules(css):
        if prelude.startswith('@font-face') or prelude.startswith('@import'):
            continue
        if prelude.startswith('@keyframes'):
            out.append(f'{indent}{rename(prelude).replace("@keyframes ", "@keyframes v7-")} {{{body}}}')
            continue
        if prelude.startswith('@media') or prelude.startswith('@supports'):
            inner = convert(body, indent + '  ')
            if inner.strip(): out.append(f'{indent}{prelude} {{\n{inner}\n{indent}}}')
            continue
        sels = [scope_selector(s) for s in prelude.split(',')]
        sels = [rename(s) for s in sels if s]
        if not sels: continue
        b = rename(body.strip())
        b = re.sub(r'animation:\s*([a-z][a-z0-9-]*)', lambda m: 'animation: ' + ('v7-' + m.group(1) if m.group(1) not in ('none','inherit') else m.group(1)), b)
        out.append(f'{indent}{", ".join(sels)} {{ {b} }}')
    return '\n'.join(out)

src = open(sys.argv[1]).read()
if sys.argv[1].endswith('.html'):
    m = re.search(r'<style>(.*?)</style>', src, flags=re.S)
    src = m.group(1) if m else ''
print(convert(src))
