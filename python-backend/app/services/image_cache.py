"""
Image analysis cache system
Stores and retrieves cached image analysis results using MD5 hashing
Reduces redundant API calls and improves performance
"""

import hashlib
import sqlite3
import json
import logging
from pathlib import Path
from typing import Optional
from datetime import datetime, timedelta
import threading

from app.models.image_context import ImageContext, AnalysisMetadata

logger = logging.getLogger(__name__)


class ImageAnalysisCache:
    """SQLite-based cache for image analysis results"""

    def __init__(self, cache_dir: Path = None, max_age_days: int = 30):
        """
        Initialize the image analysis cache

        Args:
            cache_dir: Directory to store cache database (default: ./cache)
            max_age_days: Maximum age of cached results before expiration
        """
        self.cache_dir = cache_dir or Path(__file__).parent.parent.parent / "cache"
        self.cache_dir.mkdir(exist_ok=True)
        self.db_path = self.cache_dir / "image_analysis_cache.db"
        self.max_age_days = max_age_days
        self._lock = threading.Lock()

        # Initialize database
        self._init_db()
        logger.info(f"ImageAnalysisCache initialized at {self.db_path}")

    def _init_db(self):
        """Create database tables if they don't exist"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS analysis_cache (
                        image_hash TEXT PRIMARY KEY,
                        image_context JSON NOT NULL,
                        metadata JSON NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        access_count INTEGER DEFAULT 1
                    )
                """)
                conn.commit()
                logger.debug("Cache database initialized")
        except Exception as e:
            logger.error(f"Error initializing cache database: {e}")
            raise

    @staticmethod
    def compute_image_hash(image_bytes: bytes) -> str:
        """
        Compute MD5 hash of image bytes

        Args:
            image_bytes: Raw image data

        Returns:
            Hex string of MD5 hash
        """
        return hashlib.md5(image_bytes).hexdigest()

    def get(self, image_bytes: bytes) -> Optional[tuple]:
        """
        Retrieve cached analysis result

        Args:
            image_bytes: Raw image data to look up

        Returns:
            Tuple of (ImageContext, AnalysisMetadata) or None if not found/expired
        """
        image_hash = self.compute_image_hash(image_bytes)

        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute(
                    "SELECT image_context, metadata, created_at FROM analysis_cache WHERE image_hash = ?",
                    (image_hash,)
                )
                row = cursor.fetchone()

                if not row:
                    return None

                image_context_data, metadata_data, created_at = row

                # Check if result is expired
                created_dt = datetime.fromisoformat(created_at)
                if datetime.utcnow() - created_dt > timedelta(days=self.max_age_days):
                    self._delete(image_hash)
                    logger.info(f"Cache expired for hash {image_hash[:8]}")
                    return None

                # Update access metadata
                self._update_access(image_hash)

                # Deserialize
                context_dict = json.loads(image_context_data)
                metadata_dict = json.loads(metadata_data)

                context = ImageContext(**context_dict)
                metadata = AnalysisMetadata(**metadata_dict)

                logger.info(f"Cache hit for hash {image_hash[:8]}")
                return (context, metadata)

        except Exception as e:
            logger.error(f"Error retrieving cache: {e}")
            return None

    def set(
        self,
        image_bytes: bytes,
        image_context: ImageContext,
        metadata: AnalysisMetadata
    ) -> bool:
        """
        Store analysis result in cache

        Args:
            image_bytes: Raw image data
            image_context: Analysis result
            metadata: Metadata about the analysis

        Returns:
            True if successful, False otherwise
        """
        image_hash = self.compute_image_hash(image_bytes)

        try:
            # Update image_hash in context for reference
            image_context.image_hash = image_hash

            context_json = image_context.model_dump_json()
            metadata_json = metadata.model_dump_json()

            with self._lock:
                with sqlite3.connect(self.db_path) as conn:
                    conn.execute(
                        """
                        INSERT OR REPLACE INTO analysis_cache
                        (image_hash, image_context, metadata, created_at, accessed_at, access_count)
                        VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)
                        """,
                        (image_hash, context_json, metadata_json)
                    )
                    conn.commit()

            logger.info(f"Cached analysis for hash {image_hash[:8]}")
            return True

        except Exception as e:
            logger.error(f"Error storing cache: {e}")
            return False

    def _update_access(self, image_hash: str):
        """Update access metadata when cache is hit"""
        try:
            with self._lock:
                with sqlite3.connect(self.db_path) as conn:
                    conn.execute(
                        """
                        UPDATE analysis_cache
                        SET accessed_at = CURRENT_TIMESTAMP,
                            access_count = access_count + 1
                        WHERE image_hash = ?
                        """,
                        (image_hash,)
                    )
                    conn.commit()
        except Exception as e:
            logger.warning(f"Error updating cache access metadata: {e}")

    def _delete(self, image_hash: str):
        """Delete a cache entry"""
        try:
            with self._lock:
                with sqlite3.connect(self.db_path) as conn:
                    conn.execute("DELETE FROM analysis_cache WHERE image_hash = ?", (image_hash,))
                    conn.commit()
        except Exception as e:
            logger.warning(f"Error deleting cache entry: {e}")

    def clear_expired(self) -> int:
        """
        Remove all expired cache entries

        Returns:
            Number of entries deleted
        """
        try:
            cutoff_date = (datetime.utcnow() - timedelta(days=self.max_age_days)).isoformat()

            with self._lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.execute(
                        "DELETE FROM analysis_cache WHERE created_at < ?",
                        (cutoff_date,)
                    )
                    conn.commit()
                    deleted = cursor.rowcount

            logger.info(f"Cleaned {deleted} expired cache entries")
            return deleted

        except Exception as e:
            logger.error(f"Error clearing expired cache: {e}")
            return 0

    def get_stats(self) -> dict:
        """Get cache statistics"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute(
                    """
                    SELECT
                        COUNT(*) as total_entries,
                        SUM(access_count) as total_accesses,
                        AVG(access_count) as avg_accesses,
                        MIN(created_at) as oldest_entry,
                        MAX(accessed_at) as most_recent_access
                    FROM analysis_cache
                    """
                )
                row = cursor.fetchone()

                if row:
                    return {
                        "total_entries": row[0] or 0,
                        "total_accesses": row[1] or 0,
                        "avg_accesses_per_entry": round(row[2] or 0, 2),
                        "oldest_entry": row[3],
                        "most_recent_access": row[4]
                    }
                return {
                    "total_entries": 0,
                    "total_accesses": 0,
                    "avg_accesses_per_entry": 0,
                    "oldest_entry": None,
                    "most_recent_access": None
                }

        except Exception as e:
            logger.error(f"Error getting cache stats: {e}")
            return {}
