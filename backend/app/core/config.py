from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://neuralchain:neuralchain_secret@localhost:5432/neuralchain_db"
    POSTGRES_URL: str = ""
    REDIS_URL: str = "redis://redis:6379/0"
    CELERY_BROKER_URL: str = "redis://redis:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/1"
    NEO4J_URI: str = "bolt://neo4j:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "neuralchain_neo4j"
    MAXMIND_DB_PATH: str = "/app/data/geoip/GeoLite2-City.mmdb"
    GEOIP_DB_PATH: str = "/app/data/geoip/GeoLite2-City.mmdb"
    SECRET_KEY: str = "change-this-to-a-random-secret-key-in-production"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
