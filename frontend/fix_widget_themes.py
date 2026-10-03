import os
import glob
import re

widget_dir = "src/components/DashboardWidgets"

def apply_theme_fixes(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
        
    original = content
        
    # Replace main container backgrounds
    content = content.replace('bg-gray-900', 'bg-white dark:bg-gray-900')
    content = content.replace('border-gray-800', 'border-gray-200 dark:border-gray-800')
    content = content.replace('bg-gray-800', 'bg-gray-100 dark:bg-gray-800')
    content = content.replace('bg-gray-800/70', 'bg-gray-100 dark:bg-gray-800/70')
    content = content.replace('border-gray-700/50', 'border-gray-200 dark:border-gray-700/50')
    content = content.replace('border-gray-700', 'border-gray-300 dark:border-gray-700')
    content = content.replace('bg-gray-950', 'bg-gray-50 dark:bg-gray-950')
    
    # Text colors
    content = content.replace('text-white', 'text-gray-900 dark:text-white')
    content = content.replace('text-gray-400', 'text-gray-500 dark:text-gray-400')
    content = content.replace('text-gray-300', 'text-gray-700 dark:text-gray-300')
    content = content.replace('text-gray-200', 'text-gray-800 dark:text-gray-200')
    content = content.replace('text-gray-500', 'text-gray-500 dark:text-gray-400')
    
    # Fix duplicate dark classes (if any were created by overlapping replaces)
    content = content.replace('bg-white dark:bg-white dark:bg-gray-900', 'bg-white dark:bg-gray-900')
    content = content.replace('text-gray-900 dark:text-gray-900 dark:text-white', 'text-gray-900 dark:text-white')
    content = content.replace('text-gray-500 dark:text-gray-500 dark:text-gray-400', 'text-gray-500 dark:text-gray-400')
    content = content.replace('text-gray-700 dark:text-gray-700 dark:text-gray-300', 'text-gray-700 dark:text-gray-300')
    
    if content != original:
        print(f"Fixed theme for {os.path.basename(filepath)}")
        with open(filepath, 'w') as f:
            f.write(content)

for filepath in glob.glob(f"{widget_dir}/*.jsx"):
    apply_theme_fixes(filepath)

