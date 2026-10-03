import os
import re

node_dir = '/home/pi/pido-ai/frontend/src/components/PipelineBuilder/nodes'
for filename in os.listdir(node_dir):
    if not filename.endswith('Node.jsx'):
        continue
        
    filepath = os.path.join(node_dir, filename)
    with open(filepath, 'r') as f:
        content = f.read()
        
    if 'isCompact' in content:
        continue
        
    # We only want to process files that have `export default function <Name>Node({ id, data })`
    if 'export default function ' not in content:
        continue

    print(f"Processing {filename}...")
    
    # 1. Insert `const isCompact = data?.viewMode === 'compact';`
    content = re.sub(
        r'(export default function [A-Za-z0-9_]+\(\{\s*id,\s*data(?:,\s*isConnectable)?\s*\}\)\s*\{)',
        r'\1\n  const isCompact = data?.viewMode === \'compact\';',
        content
    )
    
    # 2. Modify `w-64` or `w-72` etc to be dynamic
    # Find the outer <div className="...">
    content = re.sub(
        r'(<div className="[^"]*w-(64|72|80|96)[^"]*?")',
        lambda m: m.group(1).replace(f'w-{m.group(2)}', f'${{isCompact ? \'w-48\' : \'w-{m.group(2)}\'}}').replace('className="', 'className={`').replace('"', '`}'),
        content,
        count=1
    )

    # 3. Replace `<NodeMenu id={id} />` with `{!isCompact && <NodeMenu id={id} />}`
    content = content.replace('<NodeMenu id={id} />', '{!isCompact && <NodeMenu id={id} />}')

    # 4. Find the settings panel start. usually `<div className="p-4 ...">` or `<div className="p-3 ...">` AFTER the header.
    # We can split the return statement.
    # It usually looks like:
    #       {!isCompact && <NodeMenu id={id} />}
    #     </div>
    #     
    #     <div className="p-4 flex flex-col gap-3">
    
    match = re.search(r'(\n\s*\{!isCompact && <NodeMenu id=\{id\} />\}\s*\n\s*</div>\s*\n\s*)(<div className="p-[234].*?>)', content)
    if match:
        prefix = match.group(1)
        settings_start = match.group(2)
        
        content = content[:match.start()] + prefix + '{!isCompact && (\n        <>\n          ' + settings_start + content[match.end():]
        
        # Find the very last `</div>\n  );\n}` and insert `</>\n      )}` before it
        end_match = re.search(r'(</[A-Za-z]+>\s*\n\s*</div>\s*\n\s*\);\s*\n\})', content)
        if end_match:
            content = content[:end_match.start()] + '        </>\n      )}\n' + end_match.group(1) + content[end_match.end():]
            
            with open(filepath, 'w') as f:
                f.write(content)
            print(f"Fixed {filename}")
        else:
            print(f"Failed to find end for {filename}")
    else:
        print(f"Failed to find settings panel for {filename}")

