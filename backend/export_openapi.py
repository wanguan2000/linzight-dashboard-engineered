from __future__ import annotations

import json
import sys
from pathlib import Path

from .main import app


def export_openapi(output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    schema = app.openapi()
    output_path.write_text(json.dumps(schema, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    destination = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("docs/openapi.json")
    export_openapi(destination)
    print(f"Exported OpenAPI schema to {destination}")
