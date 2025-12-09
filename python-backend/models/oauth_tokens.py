from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class OAuthToken(Base):
    __tablename__ = 'social_oauth_tokens'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), nullable=False, unique=True, index=True)
    platform = Column(String(50), nullable=False, index=True)
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=True)
    token_type = Column(String(50), nullable=True)
    expires_in = Column(Integer, nullable=True)
    expires_at = Column(DateTime, nullable=True, index=True)
    encrypted = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_used_at = Column(DateTime, nullable=True)
    is_valid = Column(Boolean, default=True)
    
    def __repr__(self):
        return f"<OAuthToken(user_id={self.user_id}, platform={self.platform})>"
