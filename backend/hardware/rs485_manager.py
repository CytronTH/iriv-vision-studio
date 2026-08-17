import logging
import serial
import threading
import time

logger = logging.getLogger(__name__)

class RS485Manager:
    def __init__(self, port="/dev/ttyACM0", baudrate=9600):
        self.port = port
        self.baudrate = baudrate
        self.ser = None
        self.lock = threading.Lock()
        logger.info(f"Initializing RS485 on {port} at {baudrate} baud...")
        try:
            self.ser = serial.Serial(
                port=self.port,
                baudrate=self.baudrate,
                timeout=1,
                parity=serial.PARITY_NONE,
                stopbits=serial.STOPBITS_ONE,
                bytesize=serial.EIGHTBITS
            )
        except Exception as e:
            logger.error(f"Failed to open RS485 port: {e}")

    def send_data(self, data: bytes):
        if self.ser and self.ser.is_open:
            with self.lock:
                try:
                    self.ser.write(data)
                    self.ser.flush()
                except Exception as e:
                    logger.error(f"RS485 send error: {e}")

    def read_data(self, size=1024) -> bytes:
        if self.ser and self.ser.is_open:
            with self.lock:
                try:
                    if self.ser.in_waiting > 0:
                        return self.ser.read(min(size, self.ser.in_waiting))
                except Exception as e:
                    logger.error(f"RS485 read error: {e}")
        return b''

    def close(self):
        if self.ser and self.ser.is_open:
            self.ser.close()

# Global Singleton
rs485_mgr = RS485Manager()
