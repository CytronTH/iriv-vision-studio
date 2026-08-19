"""
IRIV Model Studio - CUDA Detection Script
Detects NVIDIA GPU and returns the appropriate PyTorch wheel tag.
"""
import subprocess
import re
import sys


def find_cuda_tag():
    """Try nvidia-smi in multiple locations and return the PyTorch CUDA tag."""
    candidates = [
        "nvidia-smi",
        r"C:\Windows\System32\nvidia-smi.exe",
        r"C:\Program Files\NVIDIA Corporation\NVSMI\nvidia-smi.exe",
    ]

    output = ""
    for cmd in candidates:
        try:
            r = subprocess.run(
                [cmd], capture_output=True, text=True, timeout=10
            )
            if r.returncode == 0:
                output = r.stdout
                break
        except Exception:
            continue

    if not output:
        return "cpu"

    # Parse "CUDA Version: 12.4" from nvidia-smi header
    m = re.search(r"CUDA Version:\s*([\d.]+)", output)
    if not m:
        return "cpu"

    parts = m.group(1).split(".")
    maj = int(parts[0])
    mn = int(parts[1]) if len(parts) > 1 else 0

    if maj > 12 or (maj == 12 and mn >= 4):
        return "cu124"
    elif maj == 12 and mn >= 1:
        return "cu121"
    elif maj >= 11:
        return "cu118"
    else:
        return "cpu"


if __name__ == "__main__":
    tag = find_cuda_tag()
    print(tag)
    sys.exit(0)
