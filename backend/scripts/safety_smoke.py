import asyncio
import os
import sys


_HERE = os.path.dirname(os.path.abspath(__file__))
_BACKEND_ROOT = os.path.dirname(_HERE)
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

from app.services.safety_service import SafetyService


async def main() -> None:
    svc = SafetyService(safebrowsing_api_key=None)
    out = await svc.summarize("https://example.com")
    print(out)


if __name__ == "__main__":
    asyncio.run(main())
