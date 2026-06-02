import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from core.schemas.registry import export_json_schemas, list_schemas


def main() -> int:
    parser = argparse.ArgumentParser(description="Export SignVerse JSON schemas.")
    parser.add_argument(
        "--out",
        default="exports/schemas",
        help="Directory where schema JSON files should be written.",
    )
    args = parser.parse_args()

    output_paths = export_json_schemas(Path(args.out))
    for schema in list_schemas():
        print(f"{schema['schema_id']} - {schema['title']}")
    for output_path in output_paths:
        print(f"wrote {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
