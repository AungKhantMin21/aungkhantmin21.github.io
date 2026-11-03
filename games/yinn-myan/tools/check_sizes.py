"""Enforce the GitHub Pages asset budget for the game folder.

    python3 tools/check_sizes.py

Rules (owner's): every committed file < 100 MB (GitHub's hard limit), whole game < ~300 MB.
Counts only files git would commit (respects .gitignore). Exit code 1 if a rule is broken.
"""
import pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
FILE_MAX, TOTAL_MAX, WARN_FILE = 100e6, 300e6, 25e6

out = subprocess.run(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z', '.'],
                     cwd=ROOT, capture_output=True, check=True).stdout.decode().split('\0')
files = [ROOT / f for f in out if f and (ROOT / f).is_file()]
total, bad = 0, False
for f in sorted(files, key=lambda f: -f.stat().st_size):
    n = f.stat().st_size; total += n
    if n >= FILE_MAX: print(f'TOO BIG  {n/1e6:7.1f} MB  {f.relative_to(ROOT)}'); bad = True
    elif n >= WARN_FILE: print(f'large    {n/1e6:7.1f} MB  {f.relative_to(ROOT)}')
print(f'{len(files)} files, {total/1e6:.1f} MB of {TOTAL_MAX/1e6:.0f} MB budget')
if total > TOTAL_MAX: print('OVER BUDGET'); bad = True
sys.exit(1 if bad else 0)
