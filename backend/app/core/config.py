from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    DEBUG: bool = True
    SECRET_KEY: str = "change_me"

    # PostgreSQL
    DATABASE_URL: str = "postgresql://neuralchain:neuralchain_secret@localhost:5432/neuralchain_db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Neo4j
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "neuralchain_neo4j"

    # GeoIP
    GEOIP_DB_PATH: str = "/app/data/geoip/GeoLite2-City.mmdb"

    class Config:
        env_file = ".env"


settings = Settings()
