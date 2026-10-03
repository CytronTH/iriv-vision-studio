import os
import re
import glob

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # Fix misplaced closing brace in single quotes:
    #                 } dark:text-gray-XXX'
    # `}
    # Becomes:
    #                 dark:text-gray-XXX'
    #             }`}
    # Wait, the exact string is usually:
    # "                  } dark:text-gray-400'\n`>"
    # Let's use regex to fix:
    # '...     } dark:text-gray-XXX'\n`}' -> '... dark:text-gray-XXX'\n}'
    
    # Actually, a simpler way: find any `} dark:.*?'` and move the `}`
    # The pattern is: `[ \t]+} dark:([a-z0-9:-]+)'`
    
    # Let's just fix Pattern 1 and 2:
    #   \s+\} dark:([a-zA-Z0-9:-]+)'\n\s*`\}
    # Replace with:
    #   dark:\1'\n              }`}
    
    # We can just iterate over all lines, and if a line has `} dark:` we fix it.
    
    lines = content.split('\n')
    for i, line in enumerate(lines):
        # Fix missing quotes: `? 'text-red-500 : 'text-gray-500`
        if "? 'text-" in line and ": 'text-" in line and line.count("'") % 2 != 0:
             # Just a simple heuristic for MetricWidget / WidgetSettingsModal
             line = re.sub(r"\? '([^']+?)\s+:\s+'", r"? '\1' : '", line)
             lines[i] = line
        
        # Fix } inside quotes
        if "} dark:" in line and line.endswith("'"):
             # e.g.: hover:text-gray-700                    } dark:text-gray-300'
             # We want to remove the } and put it on the next line or after the quote.
             # Wait, usually the next line is `}` or `}>`
             line = line.replace("} dark:", "dark:")
             lines[i] = line
             # if the next line is `}`, we replace it with `}`
             if i + 1 < len(lines) and lines[i+1].strip() in ["`}", "`}>", "`}"]:
                 lines[i+1] = lines[i+1].replace("`}", "}`}")
                 lines[i+1] = lines[i+1].replace("`}>", "}`}>")
                 
        elif "} dark:" in line and "`}" in line:
             # e.g.: } dark:text-gray-500`}
             line = line.replace("} dark:", "dark:")
             line = line.replace("`}", "}`}")
             lines[i] = line

    content = '\n'.join(lines)
    if content != original_content:
        print(f"Fixed {filepath}")
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

for root, _, files in os.walk('src/components'):
    for file in files:
        if file.endswith('.jsx'):
            fix_file(os.path.join(root, file))

