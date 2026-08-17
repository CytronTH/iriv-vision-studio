---
name: Hardware & I/O Constraints
description: Enforces safety and error handling for GPIO/RS485.
trigger: always_on
---

# Hardware & I/O Constraints

1. **Fault Tolerance**: All calls to physical hardware (GPIO pins, RS485 Modbus, I2C OLED) MUST be wrapped in `try...except` blocks.
2. **Timeouts**: Hardware communication MUST have explicit timeouts set to prevent the daemon from hanging indefinitely if a wire is disconnected or the PLC stops responding.
3. **Graceful Shutdown**: Always ensure hardware states are reset (e.g., turning off external relays or LEDs) upon application shutdown or unhandled exception.
