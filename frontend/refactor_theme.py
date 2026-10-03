import os
import re

def invert_gray(shade):
    shade = int(shade)
    if shade == 50: return 950
    if shade == 950: return 50
    if shade % 100 == 0:
        return 1000 - shade
    return shade

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Regex to match class strings: className="..." or className={`...`}
    # We will just do a global replacement of words, it's safer and easier.
    # We only replace words that match (prefix-)gray-(shade)
    # where prefix can be hover:, focus:, etc, or nothing.
    # We MUST NOT replace if it already has dark:
    
    def replacer(match):
        full_match = match.group(0)
        
        # If it's already a dark: class, leave it alone
        if 'dark:' in full_match:
            return full_match
            
        # Parse the prefix, utility type, and shade
        # Example: hover:bg-gray-900
        # prefix: hover:
        # utility: bg
        # color: gray
        # shade: 900
        
        m = re.match(r'^(.*:)?([a-z]+)-gray-(\d+)(/.*)?$', full_match)
        if not m:
            return full_match
            
        modifier = m.group(1) or ""
        utility = m.group(2)
        shade = m.group(3)
        opacity = m.group(4) or ""
        
        try:
            shade_int = int(shade)
            if shade_int not in [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]:
                return full_match
        except ValueError:
            return full_match
            
        inverted_shade = invert_gray(shade_int)
        
        # In the old system, the class written (e.g. bg-gray-900) was the DARK mode color, 
        # and it automatically inverted in light mode.
        # Now, we must write explicitly:
        # The light mode color is the inverted shade.
        # The dark mode color is the original shade.
        
        light_class = f"{modifier}{utility}-gray-{inverted_shade}{opacity}"
        dark_class = f"dark:{modifier}{utility}-gray-{shade}{opacity}"
        
        return f"{light_class} {dark_class}"

    # Find all words that look like tailwind gray classes
    # e.g. bg-gray-900, text-gray-200, hover:bg-gray-700
    # negative lookbehind to ensure we don't match dark:bg-gray-900
    # Wait, negative lookbehind in python doesn't allow variable length, but we can just use a simpler regex and check in the replacer.
    
    pattern = r'\b(?:[a-z0-9-]+:)*[a-z]+-gray-\d+(?:/[0-9a-zA-Z\[\]]+)?\b'
    
    new_content = re.sub(pattern, replacer, content)
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return True
    return False

changed_files = 0
for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith(('.jsx', '.js', '.tsx', '.ts')):
            filepath = os.path.join(root, file)
            if process_file(filepath):
                changed_files += 1
                print(f"Updated {filepath}")

print(f"Total files updated: {changed_files}")
