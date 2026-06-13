from pydantic import BaseModel
from typing import Dict, Any, Optional

class ParseResult(BaseModel):
    content: str
    metadata: Dict[str, Any]
