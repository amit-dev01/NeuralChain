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
    # ML & Anomaly Detection Settings
    MLFLOW_TRACKING_URI: str = "file:///app/data/mlruns"
    MLFLOW_EXPERIMENT_NAME: str = "sih26146"
    MODEL_STORE_PATH: str = "models"
    ISOLATION_FOREST_CONTAMINATION: float = 0.05
    AUTOENCODER_LATENT_DIM: int = 16
    AUTOENCODER_EPOCHS: int = 50
    AUTOENCODER_LR: float = 1e-3
    ANOMALY_WEIGHT_IF: float = 0.6
    ANOMALY_WEIGHT_AE: float = 0.4

    # AI / LLM Forensics (Gemma 4 & Gemini)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemma-4-26b-a4b-it"
    GEMINI_FALLBACK_MODEL: str = "gemini-2.5-flash"
    GEMINI_TEMPERATURE: float = 0.2
    GEMINI_MAX_OUTPUT_TOKENS: int = 4096

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
