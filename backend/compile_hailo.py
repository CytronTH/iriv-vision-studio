#!/usr/bin/env python3
"""
IRIV Model Studio — Hailo Compilation Script
Runs inside Docker container: iriv-hailo-compiler:latest

Handles:
  1. Parse ONNX → .hn or .har  (auto-retry with end nodes if needed)
     Note: standard parse → .hn, parse with --end-node-names → .har directly
  2. Optimize .hn/.har → .har   (quantization with calibration set)
  3. Compile .har → .hef

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


def main():
    if len(sys.argv) < 3:
        print("Usage: compile_hailo.py <model_name> <hw_arch>", flush=True)
        sys.exit(1)

    model_name = sys.argv[1]
    hw_arch    = sys.argv[2]

    os.chdir('/workspace')

    # ── Step 1: Parse ONNX → .hn ────────────────────────────────────────────
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
        # e.g. "Please try to parse the model again, using these end node names: /model.22/Sigmoid, /model.22/dfl/Reshape"
        match = re.search(
            r'end node names:\s*([/\w,\s\.\-]+?)(?:\n|$)', out, re.IGNORECASE
        )
        if not match:
            # fallback: look for bracket format
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

    # ── Step 2: Optimize .hn/.har → .har (quantization) ────────────────────────
    print('STEP_OPTIMIZE', flush=True)

    # When parser ran with --end-node-names it saves .har directly.
    # Standard parse saves .hn. Accept either.
    har_files = sorted(glob.glob('/workspace/*.har'))
    hn_files  = sorted(glob.glob('/workspace/*.hn'))
    parse_output = (har_files or hn_files or [None])[-1]
    if not parse_output:
        print('[IRIV] ERROR: No .hn or .har file found after parsing!', flush=True)
        sys.exit(1)
    print(f'[IRIV] Optimizing: {parse_output}', flush=True)

    code = run_streaming([
        'hailo', 'optimize', parse_output,
        '--hw-arch',        hw_arch,
        '--calib-set-path', '/calib'
    ])
    if code != 0:
        print(f'[IRIV] Optimize failed (exit {code})', flush=True)
        sys.exit(code)

    print('[IRIV] Optimize complete ✓', flush=True)

    # ── Step 3: Compile .har → .hef ─────────────────────────────────────────
    print('STEP_COMPILE', flush=True)

    # Prefer .har (output of optimize), fall back to .hn
    har_files = sorted(glob.glob('/workspace/*.har'))
    if har_files:
        input_file = har_files[-1]
    else:
        # Some DFC versions output a second .hn after optimize
        hn_after = sorted(glob.glob('/workspace/*.hn'))
        if hn_after:
            input_file = hn_after[-1]
        else:
            print('[IRIV] ERROR: No .har or .hn file found after optimize!', flush=True)
            sys.exit(1)

    hef_out = f'/workspace/{model_name}.hef'
    print(f'[IRIV] Compiling: {input_file} → {hef_out}', flush=True)

    code = run_streaming([
        'hailo', 'compiler', input_file,
        '--hw-arch', hw_arch,
        '-o', hef_out
    ])
    if code != 0:
        print(f'[IRIV] Compile failed (exit {code})', flush=True)
        sys.exit(code)

    print('COMPILE_DONE', flush=True)
    sys.exit(0)


if __name__ == '__main__':
    main()
