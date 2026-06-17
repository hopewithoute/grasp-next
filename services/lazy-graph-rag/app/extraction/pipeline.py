from typing import List, Optional, Union, Sequence
from app.extraction.contracts import ExtractorContract, Chunk, ExtractionCandidate

class TermExtractionPipeline(ExtractorContract):
    def __init__(self, extractor: Union[ExtractorContract, Sequence[ExtractorContract]]):
        if isinstance(extractor, (list, tuple)):
            self.extractors = list(extractor)
        else:
            self.extractors = [extractor]
        self.extractor = self.extractors[0] if self.extractors else None

    def extract_terms(self, chunks: List[Chunk], labels: List[str], threshold: float = 0.5, language_hint: Optional[str] = None) -> List[ExtractionCandidate]:
        candidates = []
        for ext in self.extractors:
            candidates.extend(ext.extract_terms(chunks, labels, threshold, language_hint))
        
        normalized_candidates = []
        seen = set()
        
        for cand in candidates:
            # trim
            cand.text = cand.text.strip()
            if not cand.text:
                continue
            
            # normalize text
            norm_text = cand.text.lower()
            cand.normalized_text = norm_text
            
            # dedupe exact normalized text/label/span
            key = (cand.chunkId, norm_text, cand.label, cand.startOffset, cand.endOffset)
            
            if key not in seen:
                seen.add(key)
                normalized_candidates.append(cand)
                
        return normalized_candidates
