#!/usr/bin/env python3
"""
IRIV Model Studio — Hailo Compilation Script
Runs inside Docker container: iriv-hailo-compiler:latest

Handles:
  1. Parse ONNX → .hn or .har  (auto-retry with end nodes if needed)
     Note: standard parse → .hn, parse with --end-node-names → .har directly
  2. Preprocess calibration images → .npy  (hailo optimize needs .npy, not raw images)
  3. Optimize .hn/.har → .har   (quantization with calibration set)
  4. Compile .har → .hef

Usage: python3 /compile_hailo.py <model_name> <hw_arch>
"""
import subprocess
import re
import sys
import os
import glob


def run_streaming(cmd):
    """Run command, stream stdout line-by-line, return exit code."""
    print(f"[CMD] {' '.join(cmd)}", flush=True)
    proc = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
    )
    for line in proc.stdout:
        print(line, end='', flush=True)
    proc.wait()
    return proc.returncode


def run_capture(cmd, stdin_input=''):
    """Run command non-interactively, return (returncode, combined_output)."""
    result = subprocess.run(
        cmd, capture_output=True, text=True, input=stdin_input
    )
    return result.returncode, result.stdout + result.stderr


def prepare_calib_npy(calib_dir, npy_dir, input_h=640, input_w=640, max_images=64):
    """
    Convert calibration images → .npy files required by hailo optimize.

    hailo optimize --calib-set-path expects a directory of numpy arrays
    (shape: H×W×C, dtype float32, normalized 0-1), NOT raw JPEG/PNG.
    Returns the npy_dir if any images were converted, else calib_dir.
    """
    try:
        import numpy as np
        from PIL import Image
    except ImportError:
        print('[IRIV] Warning: PIL/numpy not available — using raw calib dir', flush=True)
        return calib_dir

    os.makedirs(npy_dir, exist_ok=True)

    # Collect image files (case-insensitive extensions)
    img_paths = []
    for ext in ['jpg', 'jpeg', 'png', 'bmp', 'JPG', 'JPEG', 'PNG', 'BMP']:
        img_paths.extend(glob.glob(os.path.join(calib_dir, f'*.{ext}')))
    img_paths = sorted(set(img_paths))[:max_images]

    if not img_paths:
        print(f'[IRIV] No calibration images found in {calib_dir}', flush=True)
        return calib_dir

    print(f'[IRIV] Preprocessing {len(img_paths)} calibration images to .npy '
          f'({input_w}x{input_h}, float32, 0-1) ...', flush=True)

    count = 0
    for img_path in img_paths:
        try:
            img = Image.open(img_path).convert('RGB').resize(
                (input_w, input_h), Image.BILINEAR
            )
            arr = (np.array(img, dtype=np.float32) / 255.0)  # shape: (H, W, C)
            np.save(os.path.join(npy_dir, f'calib_{count:04d}.npy'), arr)
            count += 1
        except Exception as e:
            print(f'[IRIV] Warning: skipped {os.path.basename(img_path)}: {e}',
                  flush=True)

    print(f'[IRIV] {count} calibration .npy files ready', flush=True)
    return npy_dir if count > 0 else calib_dir


def main():
    if len(sys.argv) < 3:
        print("Usage: compile_hailo.py <model_name> <hw_arch>", flush=True)
        sys.exit(1)

    model_name = sys.argv[1]
    hw_arch    = sys.argv[2]

    os.chdir('/workspace')

    # ── Clean up stale intermediate files from previous runs ─────────────────
    # Without cleanup, old .har/.hn/.hef from a previous (different) arch run
    # would be picked up by glob, causing "wrong state" errors in hailo optimize.
    for pattern in ['*.har', '*.hn', '*.hef']:
        for stale in glob.glob(f'/workspace/{pattern}'):
            os.remove(stale)
            print(f'[IRIV] Removed stale file: {stale}', flush=True)

    # ── Step 1: Parse ONNX → .hn or .har ────────────────────────────────────
    print('STEP_PARSE', flush=True)

    base_parse_cmd = [
        'hailo', 'parser', 'onnx', 'model.onnx',
        '--net-name', model_name,
        '--hw-arch',  hw_arch
    ]

    # First attempt: send 'n' so it doesn't block on interactive prompt
    code, out = run_capture(base_parse_cmd, stdin_input='n\n')
    print(out, flush=True)

    if code != 0:
        # Extract recommended end node names from error message
        match = re.search(
            r'end node names:\s*([/\w,\s\.\-]+?)(?:\n|$)', out, re.IGNORECASE
        )
        if not match:
            match = re.search(r'end node names:\s*\[([^\]]+)\]', out)
            if match:
                nodes_raw = match.group(1)
                nodes = [n.strip().strip("'\"") for n in nodes_raw.split(',')]
            else:
                nodes = None
        else:
            nodes_raw = match.group(1)
            nodes = [n.strip() for n in re.split(r'[,\s]+', nodes_raw) if n.strip().startswith('/')]

        if nodes:
            print(f'[IRIV] Auto-retry with end nodes: {nodes}', flush=True)
            retry_cmd = base_parse_cmd + ['--end-node-names'] + nodes
            code = run_streaming(retry_cmd)
        else:
            print('[IRIV] No end node recommendations found — parse failed.', flush=True)

        if code != 0:
            print(f'[IRIV] Parse failed (exit {code})', flush=True)
            sys.exit(code)

    print('[IRIV] Parse complete ✓', flush=True)

    # ── Step 2: Preprocess calibration images → .npy ─────────────────────────
    # hailo optimize requires numpy arrays (H×W×C float32), NOT raw images.
    calib_npy_dir = '/workspace/calib_npy'
    calib_path = prepare_calib_npy('/calib', calib_npy_dir)

    # ── Step 3: Optimize .hn/.har → .har (quantization) ─────────────────────
    print('STEP_OPTIMIZE', flush=True)

    # Look for the parser output by name first (avoids picking up stale files
    # from a previous run if cleanup somehow missed them)
    parse_har = f'/workspace/{model_name}.har'
    parse_hn  = f'/workspace/{model_name}.hn'
    if os.path.exists(parse_har):
        parse_output = parse_har
    elif os.path.exists(parse_hn):
        parse_output = parse_hn
    else:
        # fallback: newest by modification time
        candidates = sorted(
            glob.glob('/workspace/*.har') + glob.glob('/workspace/*.hn'),
            key=os.path.getmtime
        )
        parse_output = candidates[-1] if candidates else None
    if not parse_output:
        print('[IRIV] ERROR: No .hn or .har file found after parsing!', flush=True)
        sys.exit(1)
    print(f'[IRIV] Optimizing: {parse_output}', flush=True)

    code = run_streaming([
        'hailo', 'optimize', parse_output,
        '--hw-arch',        hw_arch,
        '--calib-set-path', calib_path
    ])
    if code != 0:
        print(f'[IRIV] Optimize failed (exit {code})', flush=True)
        sys.exit(code)

    print('[IRIV] Optimize complete ✓', flush=True)

    # ── Step 4: Compile .har → .hef ─────────────────────────────────────────
    print('STEP_COMPILE', flush=True)

    # Prefer latest .har (output of optimize), fall back to .hn
    har_files = sorted(glob.glob('/workspace/*.har'))
    if har_files:
        input_file = har_files[-1]
    else:
        hn_after = sorted(glob.glob('/workspace/*.hn'))
        if hn_after:
            input_file = hn_after[-1]
        else:
            print('[IRIV] ERROR: No .har or .hn file found after optimize!', flush=True)
            sys.exit(1)

    hef_out = f'/workspace/{model_name}.hef'
    print(f'[IRIV] Compiling: {input_file} (output will be in /workspace/)', flush=True)

    # hailo compiler does NOT support -o flag — it auto-names output in cwd
    code = run_streaming([
        'hailo', 'compiler', input_file,
        '--hw-arch', hw_arch
    ])
    if code != 0:
        print(f'[IRIV] Compile failed (exit {code})', flush=True)
        sys.exit(code)

    # Locate the generated .hef (hailo names it after model_name in cwd)
    hef_files = sorted(glob.glob('/workspace/*.hef'))
    if hef_files:
        actual_hef = hef_files[-1]
        if actual_hef != hef_out:
            import shutil
            shutil.move(actual_hef, hef_out)
        print(f'[IRIV] HEF ready: {hef_out}', flush=True)
    else:
        print('[IRIV] Warning: .hef not found after compile!', flush=True)

    print('COMPILE_DONE', flush=True)
    sys.exit(0)


if __name__ == '__main__':
    main()
