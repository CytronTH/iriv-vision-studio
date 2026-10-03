import os
import re

node_dir = '/home/pi/pido-ai/frontend/src/components/PipelineBuilder/nodes'
for filename in os.listdir(node_dir):
    if not filename.endswith('Node.jsx'):
        continue
        
    filepath = os.path.join(node_dir, filename)
    with open(filepath, 'r') as f:
        content = f.read()

    if 'export default function ' not in content:
        continue

    # Skip files that already have isCompact handling (e.g. TargetTrackerNode, DatabaseWriterNode)
    if '{!isCompact && (' in content or 'isCompact ?' in content:
        print(f"Skipping {filename} as it already handles isCompact")
        continue

    # Add isCompact
    content = re.sub(
        r'(export default function [A-Za-z0-9_]+\(\{\s*id,\s*data(?:,\s*isConnectable)?\s*\}\)\s*\{)',
        r"\1\n  const isCompact = data?.viewMode === 'compact';",
        content
    )

    # 1. Update width in outer div
    def replace_width(match):
        w = match.group(2)
        inner = match.group(1).replace(f"w-{w}", f"${{isCompact ? 'w-48' : 'w-{w}'}}")
        if 'className="' in inner:
            inner = inner.replace('className="', 'className={`').replace('"', '`}')
        return inner
        
    content = re.sub(r'(<div className="[^"]*w-(64|72|80|96)[^"]*?")', replace_width, content, count=1)
    
    # 2. Hide NodeMenu when compact
    if '<NodeMenu id={id} />' in content:
        content = content.replace('<NodeMenu id={id} />', '{!isCompact && <NodeMenu id={id} />}')

    # 3. Add `hidden` to the settings panel
    def hide_panel(m):
        class_content = m.group(1)
        if 'hidden' in class_content:
            return m.group(0)
        
        if class_content.startswith('`'):
            new_class = class_content[:-1] + f" ${{isCompact ? 'hidden' : ''}}`"
            return f'<div className={{{new_class}}}>'
        else:
            new_class = f"`{class_content[1:-1]} ${{isCompact ? 'hidden' : ''}}`"
            return f'<div className={{{new_class}}}>'
            
    parts = content.split('{!isCompact && <NodeMenu id={id} />}', 1)
    if len(parts) == 2:
        parts[1] = re.sub(r'<div className=({?["`].*?p-[234].*?["`]}?)>', hide_panel, parts[1], count=1)
        content = parts[0] + '{!isCompact && <NodeMenu id={id} />}' + parts[1]

    with open(filepath, 'w') as f:
        f.write(content)
    print(f"Processed {filename}")

