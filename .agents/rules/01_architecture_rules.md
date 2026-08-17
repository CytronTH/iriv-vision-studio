---
name: AI & Streaming Architecture Rules
description: Enforces decoupled architecture and Zero-Copy for Hailo/GStreamer.
trigger: always_on
---

# AI & Streaming Architecture Rules

1. **Decoupled Architecture**: NEVER mix AI Inference loops (e.g., GStreamer bus polling, video frame processing) inside the Web Server (FastAPI) thread or endpoint. The AI Engine must run as an independent background process or service.
2. **Zero-Copy Memory**: ALWAYS utilize GStreamer buffers and DMA-BUF for video processing. DO NOT convert video frames to `numpy` arrays unless absolutely necessary (e.g., for OpenCV drawing). Extract AI results via JSON metadata attached to the buffer (`hailo.get_roi_from_buffer()`).
3. **Hardware Acceleration**: Always use Hailo-8/8L NPU for model inference. Do not run heavy tensor calculations on the CPU.
