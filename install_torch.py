"""
IRIV Model Studio - PyTorch installer with CUDA fallback
Tries CUDA builds in order: cu126 → cu124 → cu121 → cpu
"""
import subprocess
import sys
import importlib


CUDA_TAGS = ["cu126", "cu124", "cu121", "cpu"]


def pip_install(index_url, packages):
    """Run pip install and return True on success."""
    cmd = [sys.executable, "-m", "pip", "install"] + packages + [
        "--index-url", index_url
    ]
    print(f"[Torch] Trying: {index_url}")
    result = subprocess.run(cmd, timeout=900)
    return result.returncode == 0


def get_torch_version():
    try:
        # Force reimport after install
        if "torch" in sys.modules:
            del sys.modules["torch"]
        import torch
        return torch.__version__
    except Exception:
        return None


def main():
    packages = ["torch", "torchvision"]
    installed_tag = None

    for tag in CUDA_TAGS:
        index_url = f"https://download.pytorch.org/whl/{tag}"
        if pip_install(index_url, packages):
            ver = get_torch_version()
            if ver is not None:
                print(f"[OK] PyTorch installed: {ver}")
                if f"+{tag}" in ver or (tag == "cpu" and "+cpu" in ver):
                    installed_tag = tag
                    print(f"[OK] Confirmed CUDA tag: {tag}")
                    break
                elif tag != "cpu" and "+cpu" not in ver:
                    # CUDA build installed (version doesn't include tag in some versions)
                    installed_tag = tag
                    print(f"[OK] Installed (tag={tag}): {ver}")
                    break
                else:
                    # Got CPU build even when requesting CUDA — try next tag
                    print(f"[WARN] Got CPU build for tag={tag} ({ver}), trying next...")
                    continue
        else:
            print(f"[WARN] Install failed for tag={tag}, trying next...")

    if installed_tag is None:
        print("[ERROR] All CUDA attempts failed, falling back to CPU")
        pip_install("https://download.pytorch.org/whl/cpu", packages)

    # Final verification
    ver = get_torch_version()
    if ver:
        try:
            import torch
            cuda_ok = torch.cuda.is_available()
            gpu = torch.cuda.get_device_name(0) if cuda_ok else "N/A"
            print(f"[Verify] Torch={ver} | CUDA={cuda_ok} | GPU={gpu}")
        except Exception as e:
            print(f"[Verify] {ver} (cuda check failed: {e})")
    else:
        print("[ERROR] PyTorch could not be imported after install")
        sys.exit(1)

    sys.exit(0)


if __name__ == "__main__":
    main()
