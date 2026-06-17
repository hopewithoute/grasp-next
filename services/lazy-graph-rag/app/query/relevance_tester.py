from typing import List, Dict, Any
from app.query.generator import create_generator, AnswerGenerator, RetrievedContext
import logging

logger = logging.getLogger(__name__)

class RelevanceTester:
    def __init__(self, test_mode: bool = False, generator: AnswerGenerator = None):
        self.generator = generator or create_generator(force_test=test_mode)
        self.test_mode = test_mode

    def test_chunks_batch(self, query: str, chunks: List[Dict[str, Any]], max_budget: int) -> List[Dict[str, Any]]:
        """
        Tests chunks up to max_budget. Returns list of relevant chunks in a single batched LLM call.
        """
        chunks_to_test = chunks[:max_budget]
        if not chunks_to_test:
            return []
            
        if self.test_mode:
            # Deterministic mock behavior
            relevant_chunks = []
            for chunk in chunks_to_test:
                content = chunk.get("content", "").lower()
                if "covid" in content or "test" in query.lower():
                    relevant_chunks.append(chunk)
            return relevant_chunks

        ctxs = []
        for c in chunks_to_test:
            ctxs.append(RetrievedContext(
                chunkId=c.get("chunk_id", ""),
                documentId=c.get("document_id", ""),
                content=c.get("content", ""),
                score=0.0,
                startOffset=c.get("start_offset", 0),
                endOffset=c.get("end_offset", 0)
            ))
            
        prompt = (
            f"Determine which of the provided context chunks contain information relevant to the user query.\n"
            f"Query: {query}\n"
            f"Answer STRICTLY with a JSON array of strings containing the relevant Chunk IDs. "
            f"Do not explain. Example: [\"chunk_1\", \"chunk_2\"]. If none are relevant, output []."
        )
        
        try:
            answer = self.generator.generate_answer(prompt, ctxs)
            answer = answer.strip()
            
            # Clean up potential markdown formatting
            if answer.startswith("```json"):
                answer = answer[7:]
            if answer.startswith("```"):
                answer = answer[3:]
            if answer.endswith("```"):
                answer = answer[:-3]
            answer = answer.strip()
            
            import json
            try:
                relevant_ids = json.loads(answer)
                if not isinstance(relevant_ids, list):
                    relevant_ids = []
            except json.JSONDecodeError:
                # Fallback simple parsing if LLM failed to output JSON
                relevant_ids = [c for c in answer.replace("[", "").replace("]", "").replace("\"", "").split(",") if c.strip()]
                relevant_ids = [c.strip() for c in relevant_ids]
                
            relevant_ids_set = {str(cid).strip().upper() for cid in relevant_ids}
            relevant_chunks = [c for c in chunks_to_test if str(c.get("chunk_id", "")).strip().upper() in relevant_ids_set]
            return relevant_chunks
            
        except Exception as e:
            logger.warning(f"Relevance test batch failed: {e}")
            return []
