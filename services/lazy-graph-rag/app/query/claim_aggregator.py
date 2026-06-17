from typing import List
from difflib import SequenceMatcher
import re
from app.query.models import Claim

class ClaimAggregator:
    """Deduplicate claims using text-level fuzzy matching.

    Limitations:
    - Uses difflib.SequenceMatcher (character-level), so abbreviation-based
      or synonym-based duplicates (e.g. "AI" vs "artificial intelligence")
      will NOT be merged. True semantic dedup would require embeddings.
    - O(n²) comparison. The max_claims cap prevents runaway cost on deep
      queries that produce many claims.
    """

    def __init__(self, threshold: float = 0.8, max_claims: int = 200):
        self.threshold = threshold
        self.max_claims = max_claims

    def _normalize(self, text: str) -> str:
        # Lowercase and remove punctuation/whitespace
        text = text.lower().strip()
        text = re.sub(r'[^\w\s]', '', text)
        return " ".join(text.split())

    def aggregate(self, claims: List[Claim]) -> List[Claim]:
        # Cap input to prevent O(n²) blowup on deep queries
        capped = claims[:self.max_claims]

        aggregated: List[Claim] = []
        
        for c in capped:
            normalized_c = self._normalize(c.claim)
            matched = False
            
            for agg in aggregated:
                normalized_agg = self._normalize(agg.claim)
                ratio = SequenceMatcher(None, normalized_c, normalized_agg).ratio()
                if ratio >= self.threshold:
                    # Merge chunk_ids and keep unique
                    merged_chunk_ids = list(dict.fromkeys(agg.chunk_ids + c.chunk_ids))
                    agg.chunk_ids = merged_chunk_ids
                    matched = True
                    break
            
            if not matched:
                aggregated.append(Claim(
                    claim=c.claim,
                    chunk_ids=list(c.chunk_ids),
                    subquery=c.subquery
                ))
                
        return aggregated
