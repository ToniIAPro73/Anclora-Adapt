"""
Cache maintenance utility for Anclora Adapt backend.

Usage:
    python cache_cleanup.py --max-age-days 7 --vacuum
"""

from __future__ import annotations

import argparse
import logging
import os
import sqlite3
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.services.image_cache import ImageAnalysisCache  # noqa: E402

logger = logging.getLogger("cache_cleanup")


def cleanup_files(cache_dir: Path, max_age_seconds: int) -> int:
  """Remove generated assets older than threshold."""
  if not cache_dir.exists():
    return 0

  removed = 0
  now = time.time()
  tracked_suffixes = {".wav", ".mp3", ".ogg", ".tmp", ".png", ".jpg", ".json"}
  for item in cache_dir.rglob("*"):
    if not item.is_file():
      continue
    if item.suffix.lower() not in tracked_suffixes:
      continue
    age = now - item.stat().st_mtime
    if age > max_age_seconds:
      item.unlink(missing_ok=True)
      removed += 1
  return removed


def vacuum_sqlite(db_path: Path):
  if not db_path.exists():
    return
  conn = sqlite3.connect(db_path)
  try:
    conn.execute("VACUUM")
    conn.commit()
  finally:
    conn.close()


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(description="Cleanup cached assets")
  parser.add_argument(
    "--max-age-days",
    type=int,
    default=7,
    help="Delete cached audio/images older than this many days (default: 7)",
  )
  parser.add_argument(
    "--vacuum",
    action="store_true",
    help="Vacuum the SQLite cache after clearing expired records",
  )
  return parser.parse_args()


def main():
  args = parse_args()
  logging.basicConfig(level=logging.INFO, format="%(message)s")

  cache_root = ROOT / "cache"
  cache_root.mkdir(exist_ok=True)
  max_age_seconds = max(args.max_age_days, 1) * 24 * 60 * 60

  logger.info("Cleaning cache directory %s ...", cache_root)
  removed_files = cleanup_files(cache_root, max_age_seconds)
  logger.info("Removed %s generated assets older than %s days", removed_files, args.max_age_days)

  logger.info("Clearing expired entries from image analysis cache ...")
  image_cache = ImageAnalysisCache(cache_root)
  deleted_entries = image_cache.clear_expired()
  logger.info("Expired cache rows deleted: %s", deleted_entries)

  if args.vacuum:
    logger.info("Running VACUUM on %s ...", image_cache.db_path)
    vacuum_sqlite(image_cache.db_path)

  logger.info("Cache maintenance completed.")


if __name__ == "__main__":
  main()
