from repository.analyze_repository import AnalyzeRepository


class AnalyzeService:


    def __init__(
            self,
            repo: AnalyzeRepository,
            redis_client
    ):
        self.repo = repo
        self.redis_client = redis_client


