"""
IRIV Model Studio - PyTorch installer with CUDA fallback
Tries: cu126 → cu124 → cu121 → cpu
Uses --force-reinstall to bypass pip's "already satisfied" check
(pip treats 2.13.0+cpu and 2.13.0+cu126 as the same version otherwise)
"""
import subprocess
import sys


CUDA_TAGS = ["cu126", "cu124", "cu121", "cpu"]


def get_installed_torch():
    """Return installed torch version string, or None if not installed."""
    try:
        # Reload to get fresh version after possible reinstall
        if "torch" in sys.modules:
            del sys.modules["torch"]
        import torch
        return torch.__version__
    except ImportError:
        return None


def is_cuda_build(ver):
    """Return True if the torch version has CUDA support."""
    if ver is None:
        return False
    return "+cpu" not in ver and "+" in ver  # e.g. 2.13.0+cu126


def pip_install_torch(index_url, force=False):
    """Install torch + torchvision from index_url. Returns exit code."""
    cmd = [
        sys.executable, "-m", "pip", "install",
        "torch", "torchvision",
        "--index-url", index_url,
    ]
    if force:
        cmd.append("--force-reinstall")

    print(f"[Torch] pip install --index-url {index_url}" + (" --force-reinstall" if force else ""))
    result = subprocess.run(cmd, timeout=900)
    return result.returncode


def main():
    current = get_installed_torch()
    needs_force = current is not None  # if already installed (even +cpu), must force

    print(f"[Torch] Currently installed: {current or 'None'}")
    if current and is_cuda_build(current):
        print("[Torch] Already have CUDA build — skipping reinstall")
        print(f"[OK] {current}")
        return

    for tag in CUDA_TAGS:
        index_url = f"https://download.pytorch.org/whl/{tag}"
        rc = pip_install_torch(index_url, force=needs_force)

        if rc != 0:
            print(f"[WARN] Install failed for {tag} (exit={rc}), trying next...")
            continue

        ver = get_installed_torch()
        print(f"[Torch] After install: {ver}")

        if tag == "cpu":
            # CPU is always acceptable as last resort
            print(f"[OK] PyTorch CPU installed: {ver}")
            break

        if ver and is_cuda_build(ver):
            print(f"[OK] PyTorch CUDA installed: {ver}")
            break
        else:
            print(f"[WARN] Got CPU build even from {tag} index, trying next with --force-reinstall")
            needs_force = True
            continue

    # Final verification
    ver = get_installed_torch()
    if ver:
        try:
            import torch
            cuda_ok = torch.cuda.is_available()
            gpu = torch.cuda.get_device_name(0) if cuda_ok else "N/A"
            print(f"[Verify] Torch={ver} | CUDA={cuda_ok} | GPU={gpu}")
        except Exception as e:
            print(f"[Verify] {ver} (cuda check error: {e})")
    else:
        print("[ERROR] PyTorch could not be imported after install")
        sys.exit(1)


if __name__ == "__main__":
    main()
