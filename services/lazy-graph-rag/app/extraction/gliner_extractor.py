import os
from typing import List, Optional
from app.extraction.contracts import ExtractorContract, Chunk, ExtractionCandidate

class GLiNERExtractor(ExtractorContract):
    def __init__(self, model_name: Optional[str] = None):
        self._model = None
        self._model_name = model_name or os.environ.get("GLINER_MODEL", "urchade/gliner_medium-v2.1")
        
    def _get_model(self):
        if self._model is not None:
            return self._model
            
        try:
            from gliner import GLiNER
            self._model = GLiNER.from_pretrained(self._model_name)
            return self._model
        except Exception as exc:
            raise RuntimeError(f"GLiNER model load failed: {exc}") from exc

    def extract_terms(self, chunks: List[Chunk], labels: List[str], threshold: float = 0.5, language_hint: Optional[str] = None) -> List[ExtractionCandidate]:
        model = self._get_model()
        candidates: List[ExtractionCandidate] = []
        
        for chunk in chunks:
            try:
                entities = model.predict_entities(chunk.content, labels, threshold=threshold)
            except Exception as exc:
                raise RuntimeError(f"GLiNER inference failed: {exc}") from exc

            for entity in entities:
                start = int(entity.get("start", entity.get("startOffset", -1)))
                end = int(entity.get("end", entity.get("endOffset", -1)))
                text = str(entity.get("text", ""))
                label = str(entity.get("label", ""))
                confidence = float(entity.get("score", entity.get("confidence", 0.0)))

                if start < 0 or end <= start or end > len(chunk.content) or not text or not label:
                    continue

                candidates.append(
                    ExtractionCandidate(
                        chunkId=chunk.chunkId,
                        text=text,
                        label=label,
                        startOffset=start,
                        endOffset=end,
                        confidence=confidence,
                    )
                )

        return candidates
