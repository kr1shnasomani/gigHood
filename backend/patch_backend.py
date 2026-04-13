import os
import re

def patch_file(filepath):
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r') as f:
        content = f.read()

    # Replace / len(x) with / max(len(x), 1)
    content = re.sub(r'/ len\(([^)]+)\)', r'/ max(len(\1), 1)', content)
    
    # Replace res.data with (res.data if res and hasattr(res, "data") else [])
    # Actually, simpler: res = execute(); data = res.data or [] -> data = res.data if res and hasattr(res, 'data') else []
    content = re.sub(r'(\w+)\s*=\s*res\.data or \[\]', r'\1 = res.data if res and hasattr(res, "data") and res.data else []', content)

    with open(filepath, 'w') as f:
        f.write(content)

for root, _, files in os.walk('services'):
    for file in files:
        if file.endswith('.py'):
            patch_file(os.path.join(root, file))

