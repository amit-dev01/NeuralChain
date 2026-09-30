from neo4j import GraphDatabase
from app.core.config import settings


class Neo4jClient:
    def __init__(self):
        self.driver = GraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
        )

    def ping(self) -> bool:
        self.driver.verify_connectivity()
        return True

    def close(self):
        self.driver.close()


neo4j_client = Neo4jClient()


def get_neo4j_session():
    return neo4j_client.driver.session()
