from sqlalchemy.orm import Session


class AnalyzeRepository:

    def __init__(self,db: Session):
        self.db = db

