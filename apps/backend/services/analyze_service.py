import os

import anthropic
from fastapi import HTTPException, status

from repository.analyze_repository import AnalyzeRepository
from schema.AnalyzeDto import AnalyzeRequest, AnalyzeResponse

_ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

# claude-haiku-4-5 for fast chat responses
_MODEL = "claude-haiku-4-5-20251001"

_SYSTEM_TEMPLATE = """\
You are BizNest AI, an investment intelligence assistant for Philippine cities.
You help investors identify the best locations for their businesses based on \
real zoning classifications and hazard risk data.

City context
------------
City       : {city_name}{province_line}
Zone types : {zone_types}
Hazards    : {hazards}

Rules
-----
- Be specific and cite the zone types or hazard types that are relevant.
- Recommend zones with lower hazard exposure for business.
- If data is missing (e.g. no zoning recorded yet) say so honestly.
- Keep responses concise: 2-4 short paragraphs, no bullet-point walls.
- Never fabricate data that is not in the context above.
"""


class AnalyzeService:

    def __init__(self, repo: AnalyzeRepository, redis_client=None):
        self.repo = repo
        self.redis_client = redis_client

    def analyze(self, city_id: str, payload: AnalyzeRequest) -> AnalyzeResponse:
        if not _ANTHROPIC_API_KEY:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI service not configured (ANTHROPIC_API_KEY missing)",
            )

        city = self.repo.get_city(city_id)
        if not city:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="City not found")

        zone_types = self.repo.get_zone_types(city_id)
        hazard_rows = self.repo.get_hazard_summary(city_id)

        province_line = f", {city.province}" if getattr(city, "province", None) else ""
        zone_str = ", ".join(zone_types) if zone_types else "No zoning data recorded yet"
        hazard_str = (
            "; ".join(
                f"{h['hazard_type']} ({', '.join(h['scenarios'])})" if h["scenarios"]
                else h["hazard_type"]
                for h in hazard_rows
            )
            if hazard_rows
            else "No hazard data recorded yet"
        )

        system_prompt = _SYSTEM_TEMPLATE.format(
            city_name=city.name,
            province_line=province_line,
            zone_types=zone_str,
            hazards=hazard_str,
        )

        client = anthropic.Anthropic(api_key=_ANTHROPIC_API_KEY)
        message = client.messages.create(
            model=_MODEL,
            max_tokens=512,
            system=system_prompt,
            messages=[{"role": "user", "content": payload.question}],
        )

        answer = message.content[0].text if message.content else "No response generated."
        return AnalyzeResponse(answer=answer, city_name=city.name)