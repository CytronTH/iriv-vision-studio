import os

# 1. DatabaseMonitoring.jsx
f = 'src/components/DatabaseMonitoring.jsx'
with open(f, 'r') as file:
    content = file.read()
content = content.replace(
    "'bg-slate-800 text-gray-900 : 'text-slate-400 hover:text-slate-200'} dark:text-white'`}",
    "'bg-slate-800 text-gray-900 dark:text-white' : 'text-slate-400 hover:text-slate-200'}`}"
)
with open(f, 'w') as file:
    file.write(content)

# 2. MetricWidget.jsx
f = 'src/components/DashboardWidgets/MetricWidget.jsx'
with open(f, 'r') as file:
    content = file.read()
content = content.replace(
    "'text-red-500 : 'text-gray-500 dark:text-gray-400'",
    "'text-red-500' : 'text-gray-500 dark:text-gray-400'"
)
with open(f, 'w') as file:
    file.write(content)

# 3. ClassFilterSelector.jsx
f = 'src/components/PipelineBuilder/nodes/ClassFilterSelector.jsx'
with open(f, 'r') as file:
    content = file.read()
content = content.replace(
    "border-gray-700'\n                  dark:text-gray-400}`}",
    "border-gray-700 dark:text-gray-400}`}"
)
with open(f, 'w') as file:
    file.write(content)

# 4. SnapshotNodeSettings.jsx
f = 'src/components/PipelineBuilder/settings/SnapshotNodeSettings.jsx'
with open(f, 'r') as file:
    content = file.read()
content = content.replace(
    "border-transparent'dark:text-gray-400 dark:hover:text-gray-700 dark:text-gray-300`}",
    "border-transparent dark:text-gray-400 dark:hover:text-gray-700 dark:text-gray-300'`}"
)
with open(f, 'w') as file:
    file.write(content)

# 5. PayloadPathSelector.jsx
f = 'src/components/PipelineBuilder/settings/PayloadPathSelector.jsx'
with open(f, 'r') as file:
    content = file.read()
content = content.replace(
    "hover:text-white'dark:text-gray-300`}",
    "hover:text-white dark:text-gray-300'`}"
)
with open(f, 'w') as file:
    file.write(content)

print("Done")
