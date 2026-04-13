import os
import glob
import re

for root, _, files in os.walk('src/app'):
    for f in files:
        if f.endswith('.tsx') or f.endswith('.css'):
            path = os.path.join(root, f)
            with open(path, 'r') as file:
                content = file.read()
            
            # Simple global swaps
            content = content.replace("color: 'white'", "color: 'var(--text-primary)'")
            content = content.replace('color: "white"', 'color: "var(--text-primary)"')
            content = content.replace("color: '#34D399'", "color: 'var(--success)'")
            content = content.replace('color: "#34D399"', 'color: "var(--success)"')
            content = content.replace("color: '#EF4444'", "color: 'var(--danger)'")
            content = content.replace('color: "#EF4444"', 'color: "var(--danger)"')
            content = content.replace("color: '#FACC15'", "color: 'var(--warning)'")
            content = content.replace('color: "#FACC15"', 'color: "var(--warning)"')
            
            # Swap background success
            content = content.replace("background: '#34D399'", "background: 'var(--success)'")
            content = content.replace('background: "#34D399"', 'background: "var(--success)"')
            
            # Fix text-secondary explicitly where needed
            content = content.replace("var(--text-muted)", "var(--text-secondary)")
            
            with open(path, 'w') as file:
                file.write(content)

