"""JanDrishti Backend Application Package"""
import sys
import os

# Ensure repository root and backend directory are in sys.path
backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
repo_root = os.path.abspath(os.path.join(backend_root, ".."))

for path in [repo_root, backend_root]:
    if path not in sys.path:
        sys.path.insert(0, path)

