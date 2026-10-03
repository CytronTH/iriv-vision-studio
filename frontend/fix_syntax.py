import os
import re

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    def repl(m):
        class_name = m.group(1) 
        spaces = m.group(2) 
        dark_class = m.group(3) 
        return f"{class_name} {dark_class}'\n{spaces}}}`}}"
        
    pattern = r"([a-zA-Z0-9-:]+)( +)\} (dark:[a-zA-Z0-9-:]+(?: dark:[a-zA-Z0-9-:]+)*)'\n`\}"
    
    new_content = re.sub(pattern, repl, content)
    
    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        return True
    return False

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith('.jsx'):
            filepath = os.path.join(root, file)
            if fix_file(filepath):
                print(f"Fixed {filepath}")
