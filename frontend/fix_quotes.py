import os
node_dir = '/home/pi/pido-ai/frontend/src/components/PipelineBuilder/nodes'
for filename in os.listdir(node_dir):
    if not filename.endswith('Node.jsx'): continue
    filepath = os.path.join(node_dir, filename)
    with open(filepath, 'r') as f:
        content = f.read()
    if "\\'compact\\'" in content:
        content = content.replace("\\'compact\\'", "'compact'")
        with open(filepath, 'w') as f:
            f.write(content)
        print(f'Fixed quote in {filename}')
