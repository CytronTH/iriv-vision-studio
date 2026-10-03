import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    def replacer(match):
        full_match = match.group(0)
        
        # If the class string already contains dark:text-, leave it alone
        if 'dark:text-' in full_match:
            return full_match
            
        # We only want to replace text-white if there is a bg-gray- in the same class string,
        # OR if it's a generic modal/panel where text should adapt.
        # Actually, it's safer to just replace all `text-white` that are NOT on a button background.
        # Known button backgrounds: bg-blue, bg-green, bg-red, bg-yellow, bg-pink, bg-indigo, bg-purple
        button_bg = re.search(r'bg-(blue|green|red|yellow|pink|indigo|purple)-\d+', full_match)
        if button_bg:
            return full_match
            
        # Also ignore if it's bg-[#something] or bg-black, since white text on dark bg is fine.
        if re.search(r'bg-\[#|bg-black', full_match):
            return full_match

        # If it has hover:bg-gray-, it's probably a menu item where we want text-gray-900 dark:text-white
        
        # Replace text-white with text-gray-900 dark:text-white
        # We need to be careful with things like hover:text-white
        
        def sub_text_white(m2):
            prefix = m2.group(1) or ""
            # if the prefix already has dark:, skip
            if "dark:" in prefix:
                return m2.group(0)
            return f"{prefix}text-gray-900 dark:{prefix}text-white"
            
        # Replace only the exact words text-white, hover:text-white, etc.
        new_class_str = re.sub(r'\b([a-z0-9-]+:)?text-white\b', sub_text_white, full_match)
        return new_class_str

    # Find all className="..." or className={`...`}
    # This regex is simple but effective for JSX.
    pattern = r'className=(["\'])(.*?)\1|className=\{`([^`]*?)`\}'
    
    def outer_replacer(match):
        if match.group(2) is not None:
            new_inner = replacer(match)
            # The replacer function above actually was written to take the full matched string
            pass # wait, let's just do a simpler global replacement on the content
            
    # Better approach: Just iterate over all class strings
    def class_str_replacer(match):
        is_quote = match.group(1) is not None
        quote = match.group(1) if is_quote else '`'
        inner = match.group(2) if is_quote else match.group(3)
        
        if 'dark:text-' in inner:
            return match.group(0)
            
        if re.search(r'bg-(blue|green|red|yellow|pink|indigo|purple)-\d+', inner):
            return match.group(0)
            
        if re.search(r'bg-\[#|bg-black', inner):
            return match.group(0)
            
        def sub_text_white(m2):
            prefix = m2.group(1) or ""
            if "dark:" in prefix:
                return m2.group(0)
            # if we are doing hover:text-white on a dark background menu item?
            # if we are in light mode, text should be dark gray, in dark mode white.
            return f"{prefix}text-gray-900 dark:{prefix}text-white"
            
        new_inner = re.sub(r'\b([a-z0-9-]+:)?text-white\b', sub_text_white, inner)
        
        if is_quote:
            return f'className={quote}{new_inner}{quote}'
        else:
            return f'className={{{quote}{new_inner}{quote}}}'

    new_content = re.sub(pattern, class_str_replacer, content)
    
    # Also handle text-black -> text-gray-50 dark:text-black
    def text_black_replacer(match):
        inner = match.group(2) if match.group(1) else match.group(3)
        quote = match.group(1) or '`'
        is_quote = match.group(1) is not None
        
        if 'dark:text-' in inner:
            return match.group(0)
            
        def sub_text_black(m2):
            prefix = m2.group(1) or ""
            if "dark:" in prefix:
                return m2.group(0)
            return f"{prefix}text-gray-50 dark:{prefix}text-black"
            
        new_inner = re.sub(r'\b([a-z0-9-]+:)?text-black\b', sub_text_black, inner)
        if is_quote:
            return f'className={quote}{new_inner}{quote}'
        else:
            return f'className={{{quote}{new_inner}{quote}}}'

    new_content = re.sub(pattern, text_black_replacer, new_content)

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
