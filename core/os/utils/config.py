from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    os_api_key: str = "signverse_local_dev_key"
    postgres_uri: str = "sqlite:///./signverse.db"
    environment: str = "development"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
