import re

with open('src/components/PipelineBuilder/PipelineBuilder.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fixes
content = content.replace("} dark:text-gray-500`}", "}`}")
content = content.replace("} dark:text-gray-300'\n`>", "dark:text-gray-300'\n                    }`>")

with open('src/components/PipelineBuilder/PipelineBuilder.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
