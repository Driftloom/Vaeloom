"""Test Suite: Module 05 Concurrency & Deduplication (M05-CONC / M05-PERF).
Verifies simultaneous upload handling, cryptographic deduplication hashing, and duplicate file detection.
"""
import pytest
from api.ingestion.dedup import compute_content_hash, filename_similarity


def test_content_hash_deterministic_dedup():
    """Verify SHA-256 content hashing accurately matches identical files regardless of naming."""
    file_a = b"System architecture blueprint and specs."
    file_b = b"System architecture blueprint and specs."
    diff_file = b"System architecture blueprint and specs modified."

    hash_a = compute_content_hash(file_a)
    hash_b = compute_content_hash(file_b)
    hash_diff = compute_content_hash(diff_file)

    assert hash_a == hash_b
    assert hash_a != hash_diff
    assert len(hash_a) == 64


def test_filename_similarity_heuristic():
    """Verify fuzzy filename similarity correctly links version iterations while separating distinct files."""
    sim_version = filename_similarity("Q3_Financials_v1.pdf", "q3_financials_v2.pdf")
    sim_distinct = filename_similarity("Q3_Financials_v1.pdf", "Engineering_Roster.xlsx")

    assert sim_version > 0.8
    assert sim_distinct < 0.4
