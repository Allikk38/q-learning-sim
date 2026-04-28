import os
from datetime import datetime

OUTPUT = "project_dump.txt"
EXCLUDE_DIRS = {"__pycache__", ".git", "venv", ".venv", "node_modules", ".pytest_cache"}
TEXT_EXT = {".py", ".js", ".html", ".css", ".json", ".md", ".txt", ".ini"}

def lang(ext):
    return {".py": "python", ".js": "javascript", ".html": "html", ".css": "css", ".json": "json", ".md": "markdown", ".ini": "ini"}.get(ext, "")

root = os.path.dirname(os.path.abspath(__file__))
lines = []

lines.append("=" * 60)
lines.append(f"ДАМП ПРОЕКТА: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
lines.append("=" * 60)
lines.append("\n1. ДЕРЕВО ПРОЕКТА\n")

files_list = []
for dirpath, dirnames, filenames in os.walk(root):
    dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
    for f in filenames:
        ext = os.path.splitext(f)[1].lower()
        if ext in TEXT_EXT:
            full = os.path.join(dirpath, f)
            rel = os.path.relpath(full, root).replace("\\", "/")
            with open(full, "r", encoding="utf-8") as fh:
                content = fh.read()
            lc = content.count("\n")
            lines.append(f"{rel} — {lc} строк, {os.path.getsize(full)} байт")
            files_list.append((rel, full, ext))

lines.append("\n2. СОДЕРЖИМОЕ ФАЙЛОВ\n")

for rel, full, ext in files_list:
    with open(full, "r", encoding="utf-8") as fh:
        content = fh.read()
    l = lang(ext)
    lines.append(f"\n--- ФАЙЛ: {rel} ---")
    if l:
        lines.append(f"```{l}")
    lines.append(content.rstrip())
    if l:
        lines.append("```")

with open(OUTPUT, "w", encoding="utf-8") as fh:
    fh.write("\n".join(lines))

print(f"Готово: {OUTPUT} ({os.path.getsize(OUTPUT)/1024:.1f} КБ)")