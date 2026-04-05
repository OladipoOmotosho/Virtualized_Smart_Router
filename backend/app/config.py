from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    alert_recipient: str = ""

    db_path: str = "gateway.db"
    pcap_dir: str = "pcaps"
    log_retention_days: int = 30
    ips_poll_interval: int = 5


settings = Settings()
