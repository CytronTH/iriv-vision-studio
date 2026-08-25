import logging
from gpiozero import DigitalInputDevice, DigitalOutputDevice, PWMOutputDevice, Buzzer

logger = logging.getLogger(__name__)

# Pin Mapping from Datasheet
PIN_MAP = {
    "DI0": 22,
    "DI1": 27,
    "DO0": 23,
    "DO1": 24,
    "L0": 12,
    "L1": 13,
    "BUZZER": 19,
    "LED0": 20,
    "LED1": 21,
    "USER_BTN": 4
}

class GPIOManager:
    def __init__(self):
        self.devices = {}
        logger.info("Initializing GPIO Manager for IRIV EdgeAI CM5...")

    def setup_input(self, name, pin, bounce_time=0.1):
        if name not in self.devices:
            try:
                self.devices[name] = DigitalInputDevice(pin, bounce_time=bounce_time)
                logger.info(f"Initialized Input {name} on GPIO{pin}")
            except Exception as e:
                logger.error(f"Failed to init {name}: {e}")

    def setup_output(self, name, pin):
        if name not in self.devices:
            try:
                self.devices[name] = DigitalOutputDevice(pin)
                logger.info(f"Initialized Output {name} on GPIO{pin}")
            except Exception as e:
                logger.error(f"Failed to init {name}: {e}")

    def setup_pwm(self, name, pin):
        if name not in self.devices:
            try:
                self.devices[name] = PWMOutputDevice(pin)
                logger.info(f"Initialized PWM {name} on GPIO{pin}")
            except Exception as e:
                logger.error(f"Failed to init {name}: {e}")

    def setup_buzzer(self, name, pin):
        if name not in self.devices:
            try:
                self.devices[name] = Buzzer(pin)
                logger.info(f"Initialized Buzzer {name} on GPIO{pin}")
            except Exception as e:
                logger.error(f"Failed to init {name}: {e}")

    def set_output(self, name, state: bool):
        if name in self.devices and isinstance(self.devices[name], (DigitalOutputDevice, Buzzer)):
            if state:
                self.devices[name].on()
            else:
                self.devices[name].off()

    def set_pwm(self, name, value: float):
        """Value from 0.0 to 1.0"""
        if name in self.devices and isinstance(self.devices[name], PWMOutputDevice):
            self.devices[name].value = max(0.0, min(1.0, value))

    def get_input(self, name) -> bool:
        if name in self.devices and isinstance(self.devices[name], DigitalInputDevice):
            return self.devices[name].is_active
        return False

    def turn_off_all(self):
        for name, device in self.devices.items():
            try:
                if isinstance(device, PWMOutputDevice):
                    device.value = 0.0
                elif hasattr(device, 'off'):
                    device.off()
            except Exception as e:
                logger.error(f"Error turning off {name}: {e}")

    def close(self):
        self.turn_off_all()
        for name, device in self.devices.items():
            try:
                device.close()
            except Exception as e:
                logger.error(f"Error closing {name}: {e}")
        self.devices.clear()

# Global Singleton
gpio_mgr = GPIOManager()
