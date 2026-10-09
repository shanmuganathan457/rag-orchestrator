import json
from app.api.v1.endpoints.chat import sse_event
from app.services.rag import validate_citations


def test_citation_validation_handles_valid_invalid_and_repeated_references():
    assert validate_citations("Answer [1][2][2][4]", 2) == {"citations": [1, 2], "invalid_citations": [4], "has_citations": True}
    assert validate_citations("No references", 0) == {"citations": [], "invalid_citations": [], "has_citations": False}


def test_sse_events_are_json_and_unicode_safe():
    wire = sse_event("token", {"text": "line one\n??????"})
    assert wire.startswith("event: token\n")
    assert json.loads(wire.split("data: ", 1)[1]) == {"text": "line one\n??????"}