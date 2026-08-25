"""
stream_quality.py — Adaptive Display Stream Quality Manager

Monitors CPU usage and number of active AI streams to automatically
select the optimal display resolution tier, then fires a callback
when the tier stabilises so the pipeline can be restarted.

Decision matrix:
                CPU < 35%   35–55%    55–70%   > 70%
    1 stream:   Tier 0      Tier 1    Tier 2   Tier 2
    2 streams:  Tier 1      Tier 1    Tier 2   Tier 3
    3–4 streams:Tier 2      Tier 2    Tier 3   Tier 3
    5+ streams: Tier 3      Tier 3    Tier 3   Tier 3
"""

import threading
import time
import logging
from typing import Callable, Optional, Tuple

logger = logging.getLogger(__name__)

try:
    import psutil
    _HAS_PSUTIL = True
except ImportError:
    _HAS_PSUTIL = False
    logger.warning("[StreamQuality] psutil not available — falling back to /proc/stat")

# (width, height, bitrate_kbps, label)
QUALITY_TIERS: list[Tuple[int, int, int, str]] = [
    (1280, 720,  2000, "720p"),
    (854,  480,  700,  "480p"),
    (640,  360,  400,  "360p"),
    (426,  240,  200,  "240p"),
]

_MONITOR_INTERVAL  = 10   # seconds between CPU checks
_STABILITY_SECS    = 60   # seconds a candidate tier must be stable before triggering restart


class StreamQualityManager:
    """
    Selects display resolution based on live CPU% and stream count.
    Runs a background thread that calls `on_tier_change` when the tier
    has been stable at a new value for `_STABILITY_SECS` seconds.
    """

    def __init__(self):
        self._current_tier: int = 2          # Start at 360p (safe default for Pi 5)
        self._pending_tier: Optional[int]  = None
        self._pending_since: Optional[float] = None
        self._stop_event = threading.Event()
        self._monitor_thread: Optional[threading.Thread] = None

    # ── Public API ────────────────────────────────────────────────────────────

    @staticmethod
    def select_tier(cpu_percent: float, num_streams: int) -> int:
        """Pure function: return tier index 0–3 given CPU% and stream count."""
        if   cpu_percent < 35: cpu_tier = 0
        elif cpu_percent < 55: cpu_tier = 1
        elif cpu_percent < 70: cpu_tier = 2
        else:                  cpu_tier = 3

        if   num_streams <= 1: stream_boost = 0
        elif num_streams == 2: stream_boost = 1
        elif num_streams <= 4: stream_boost = 2
        else:                  stream_boost = 3

        return min(cpu_tier + stream_boost, len(QUALITY_TIERS) - 1)

    def get_display_resolution(self, num_streams: int) -> Tuple[int, int, int, str]:
        """
        Compute and apply the best resolution tier right now.
        Returns (width, height, bitrate_kbps, label) and updates self._current_tier.
        Call this once when building the pipeline for the first time.
        """
        cpu  = self._get_cpu()
        tier = self.select_tier(cpu, num_streams)
        self._current_tier = tier
        w, h, kbps, label = QUALITY_TIERS[tier]
        logger.info(
            f"[StreamQuality] CPU={cpu:.1f}%  streams={num_streams}"
            f"  → Tier {tier} ({label}  {w}×{h}  {kbps} kbps)"
        )
        return w, h, kbps, label

    @property
    def current_tier(self) -> int:
        return self._current_tier

    @property
    def current_resolution(self) -> Tuple[int, int, int, str]:
        return QUALITY_TIERS[self._current_tier]

    def start_monitor(
        self,
        num_streams_fn: Callable[[], int],
        on_tier_change: Callable[[int, Tuple[int, int, int, str]], None],
    ) -> None:
        """
        Start the background CPU monitor.

        :param num_streams_fn: Returns current number of active AI streams.
        :param on_tier_change: Called with (new_tier, resolution_tuple) after the
                               new tier has been stable for _STABILITY_SECS seconds.
        """
        if self._monitor_thread and self._monitor_thread.is_alive():
            return
        self._stop_event.clear()
        self._monitor_thread = threading.Thread(
            target=self._monitor_loop,
            args=(num_streams_fn, on_tier_change),
            daemon=True,
            name="StreamQualityMonitor",
        )
        self._monitor_thread.start()
        logger.info("[StreamQuality] Monitor started")

    def stop_monitor(self) -> None:
        """Signal the background thread to stop and wait for it."""
        self._stop_event.set()
        if self._monitor_thread:
            self._monitor_thread.join(timeout=5)
            self._monitor_thread = None
        logger.info("[StreamQuality] Monitor stopped")

    # ── Internal helpers ──────────────────────────────────────────────────────

    @staticmethod
    def _get_cpu() -> float:
        """Return current CPU usage %. Blocks briefly for accuracy."""
        if _HAS_PSUTIL:
            return psutil.cpu_percent(interval=2)
        # Fallback: two-sample /proc/stat reading
        try:
            def _read():
                with open("/proc/stat") as f:
                    parts = f.readline().split()
                idle  = int(parts[4])
                total = sum(int(x) for x in parts[1:])
                return idle, total

            i1, t1 = _read()
            time.sleep(0.5)
            i2, t2 = _read()
            dt = t2 - t1
            return 100.0 * (1.0 - (i2 - i1) / dt) if dt else 50.0
        except Exception:
            return 50.0   # conservative fallback

    def _monitor_loop(
        self,
        num_streams_fn: Callable[[], int],
        on_tier_change: Callable[[int, Tuple[int, int, int, str]], None],
    ) -> None:
        while not self._stop_event.is_set():
            try:
                num_streams = num_streams_fn()
                if num_streams == 0:
                    # Nothing running — reset pending state, wait
                    self._pending_tier  = None
                    self._pending_since = None
                    self._stop_event.wait(_MONITOR_INTERVAL)
                    continue

                cpu          = self._get_cpu()
                desired_tier = self.select_tier(cpu, num_streams)

                if desired_tier != self._current_tier:
                    if self._pending_tier != desired_tier:
                        # New candidate — start stability timer
                        self._pending_tier  = desired_tier
                        self._pending_since = time.time()
                        logger.debug(
                            f"[StreamQuality] Candidate: Tier {self._current_tier}→{desired_tier}"
                            f"  (CPU={cpu:.1f}%  streams={num_streams})"
                        )
                    elif time.time() - self._pending_since >= _STABILITY_SECS:
                        # Stable long enough → confirm and fire callback
                        old_tier           = self._current_tier
                        self._current_tier = desired_tier
                        self._pending_tier  = None
                        self._pending_since = None
                        res = QUALITY_TIERS[desired_tier]
                        logger.info(
                            f"[StreamQuality] Confirmed: Tier {old_tier}→{desired_tier}"
                            f"  ({res[3]}  {res[0]}×{res[1]})"
                        )
                        try:
                            on_tier_change(desired_tier, res)
                        except Exception as exc:
                            logger.error(f"[StreamQuality] on_tier_change error: {exc}")
                else:
                    # Back to current tier — reset pending
                    self._pending_tier  = None
                    self._pending_since = None

            except Exception as exc:
                logger.error(f"[StreamQuality] Monitor error: {exc}")

            self._stop_event.wait(_MONITOR_INTERVAL)
