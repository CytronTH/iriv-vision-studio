"""
IRIV Model Studio - PyTorch installer with CUDA fallback
Tries: cu126 → cu124 → cu121 → cpu
Uses subprocess to check torch version (avoids C extension reimport conflict)
"""
import subprocess
import sys


CUDA_TAGS = ["cu126", "cu124", "cu121", "cpu"]


def get_torch_version():
    """Check installed torch version via subprocess (avoids same-process reimport crash)."""
    try:
        result = subprocess.run(
            [sys.executable, "-c", "import torch; print(torch.__version__)"],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0:
            return result.stdout.strip()
        return None
    except Exception:
        return None


def is_cuda_build(ver):
    """Return True if torch version has CUDA support (e.g. 2.13.0+cu126)."""
    if ver is None:
        return False
    return "+" in ver and "+cpu" not in ver


def pip_install_torch(index_url, force=False):
    """Install torch + torchvision. Returns exit code."""
    cmd = [
        sys.executable, "-m", "pip", "install",
        "torch", "torchvision",
        "--index-url", index_url,
    ]
    if force:
        cmd.append("--force-reinstall")

    label = f"--index-url {index_url}" + (" --force-reinstall" if force else "")
    print(f"[Torch] pip install {label}")
    sys.stdout.flush()

    result = subprocess.run(cmd, timeout=900)
    return result.returncode


def verify_cuda():
    """Return (version, cuda_available, gpu_name) via subprocess."""
    code = (
        "import torch; "
        "c=torch.cuda.is_available(); "
        "g=torch.cuda.get_device_name(0) if c else 'N/A'; "
        "print(torch.__version__, c, g)"
    )
    try:
        r = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True, text=True, timeout=30
        )
        if r.returncode == 0:
            parts = r.stdout.strip().split(" ", 2)
            ver = parts[0] if len(parts) > 0 else "?"
            cuda = parts[1] == "True" if len(parts) > 1 else False
            gpu = parts[2] if len(parts) > 2 else "N/A"
            return ver, cuda, gpu
    except Exception as e:
        print(f"[WARN] verify_cuda error: {e}")
    return None, False, "N/A"


def main():
    current = get_torch_version()
    print(f"[Torch] Currently installed: {current or 'None'}")

    # If already CUDA build, skip reinstall
    if current and is_cuda_build(current):
        print(f"[OK] Already have CUDA build: {current} — skipping reinstall")
        ver, cuda, gpu = verify_cuda()
        print(f"[Verify] CUDA={cuda} | GPU={gpu}")
        return

    # Need to (re)install — use force if already installed (any version)
    needs_force = current is not None

    for tag in CUDA_TAGS:
        index_url = f"https://download.pytorch.org/whl/{tag}"
        rc = pip_install_torch(index_url, force=needs_force)

        if rc != 0:
            print(f"[WARN] pip failed for {tag} (exit={rc}), trying next...")
            needs_force = True
            continue

        # Check version via subprocess (not same-process import)
        ver = get_torch_version()
        print(f"[Torch] After install ({tag}): {ver}")

        if tag == "cpu":
            print(f"[OK] PyTorch CPU installed: {ver}")
            break

        if ver and is_cuda_build(ver):
            print(f"[OK] PyTorch CUDA installed: {ver}")
            break
        else:
            print(f"[WARN] Still CPU build after {tag}, trying next with --force-reinstall")
            needs_force = True
            continue

    # Final verification via subprocess
    ver, cuda, gpu = verify_cuda()
    if ver:
        print(f"[Verify] Torch={ver} | CUDA={cuda} | GPU={gpu}")
        if cuda:
            print("[OK] CUDA is available!")
        else:
            print("[WARN] CUDA not available — will train on CPU")
    else:
        print("[ERROR] PyTorch import failed in verification")
        sys.exit(1)


if __name__ == "__main__":
    main()
