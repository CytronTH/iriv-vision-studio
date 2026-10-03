import os
import re

def clean_duplicate_dark(content):
    # Rule 1: 'text-gray-100 dark:text-gray-900 dark:text-white' -> 'text-gray-900 dark:text-white'
    content = content.replace('text-gray-100 dark:text-gray-900 dark:text-white', 'text-gray-900 dark:text-white')
    
    # Rule 2: 'text-gray-[xxx] dark:text-gray-[yyy] dark:text-gray-[zzz]'
    # We want to keep 'text-gray-[xxx]' and 'dark:text-gray-[zzz]' (the last one was usually the manual one that is correct)
    # Actually let's just write a regex to find any sequence of multiple dark:text- classes and keep the last one.
    
    def replacer(match):
        classes = match.group(0).split()
        # Keep non-dark classes and the LAST dark:text- class
        non_dark = [c for c in classes if not c.startswith('dark:text-')]
        dark_text = [c for c in classes if c.startswith('dark:text-')]
        
        final_classes = non_dark
        if dark_text:
            final_classes.append(dark_text[-1]) # keep the last one, assuming it's the intended one or the manual one
            
        return ' '.join(final_classes)
        
    # Match sequences like "text-gray-500 dark:text-gray-500 dark:text-gray-400"
    # We'll just look for a word boundary, some text class, followed by multiple dark:text classes
    # Simple regex to find the problematic chunks:
    pattern = r'(?:text-[a-z0-9-]+ )?(?:dark:text-[a-z0-9-]+ ){1,}dark:text-[a-z0-9-]+'
    
    # Let's be safer and more generic: find any className string, and parse it.
    def class_str_replacer(match):
        is_quote = match.group(1) is not None
        quote = match.group(1) if is_quote else '`'
        inner = match.group(2) if is_quote else match.group(3)
        
        classes = inner.split(' ')
        new_classes = []
        dark_text_dict = {} # key: base utility (e.g. text-gray, hover:text-gray), value: full class
        
        for c in classes:
            if c.startswith('dark:text-') or 'dark:hover:text-' in c or 'dark:focus:text-' in c:
                # it's a dark text class. We extract the prefix (e.g., dark:text, dark:hover:text)
                parts = c.split('-')
                prefix = parts[0] # dark:text, etc.
                # Actually, there can only be one dark:text-color, one dark:hover:text-color etc.
                # Let's extract the full modifier prefix:
                mod_m = re.match(r'(dark:(?:hover:|focus:|active:)?text-)', c)
                if mod_m:
                    mod_prefix = mod_m.group(1)
                    dark_text_dict[mod_prefix] = c
                else:
                    new_classes.append(c)
            else:
                new_classes.append(c)
                
        # Re-append the unique dark classes (the last one encountered overwrites earlier ones)
        for val in dark_text_dict.values():
            new_classes.append(val)
            
        # Also clean up "text-gray-100 dark:text-white" -> wait, if it was text-white, it was meant to be dark in light mode, so text-gray-900.
        # If I see "text-gray-100" and "dark:text-white", it means my script inverted text-gray-900 into text-gray-100, which is wrong.
        # We should fix that specific case:
        final_str = ' '.join(new_classes)
        final_str = final_str.replace('text-gray-100 dark:text-white', 'text-gray-900 dark:text-white')
        
        if is_quote:
            return f'className={quote}{final_str}{quote}'
        else:
            return f'className={{{quote}{final_str}{quote}}}'
            
    class_pattern = r'className=(["\'])(.*?)\1|className=\{`([^`]*?)`\}'
    new_content = re.sub(class_pattern, class_str_replacer, content)
    
    return new_content

changed_files = 0
for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith(('.jsx', '.js', '.tsx', '.ts')):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            new_content = clean_duplicate_dark(content)
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                changed_files += 1
                print(f"Cleaned duplicates in {filepath}")

print(f"Total files cleaned: {changed_files}")
