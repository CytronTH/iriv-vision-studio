import re

with open('src/components/PipelineBuilder/Sidebar.jsx', 'r') as f:
    content = f.read()

# I want to add TargetTracker, DatabaseWriter, CollectionWriter, UnitThroughput
new_nodes = """
      { type: 'targetTrackerNode', label: '🎯 Target Tracker' },
      { type: 'databaseWriterNode', label: '💾 Database Writer' },
      { type: 'collectionWriterNode', label: '📚 Collection Writer' },
      { type: 'unitThroughputNode', label: '⏱️ Unit Throughput' },
"""

content = content.replace("{ type: 'actionNode', label: '⚡ Action / Alarm' },", "{ type: 'actionNode', label: '⚡ Action / Alarm' },\n" + new_nodes.strip())

with open('src/components/PipelineBuilder/Sidebar.jsx', 'w') as f:
    f.write(content)
