"""Re-export the application configuration object factory."""

from config import AppConfig, CONFIG_PATH, APP_NAME, APP_VERSION, BASE_DIR

__all__ = ["AppConfig", "CONFIG_PATH", "APP_NAME", "APP_VERSION", "BASE_DIR"]
