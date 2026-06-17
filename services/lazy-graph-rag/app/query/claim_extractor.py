from typing import List, Dict, Any
import json
import logging
import re
from app.query.models import Claim
from app.query.generator import create_generator, AnswerGenerator

logger = logging.getLogger(__name__)

class ClaimExtractor:
    def __init__(self, generator: AnswerGenerator = None, test_mode: bool = False):
        self.generator = generator or create_generator(force_test=test_mode)

    def extract_claims(self, query: str, chunks: List[Dict[str, Any]]) -> List[Claim]:
        if not chunks:
            return []
            
        context_texts = []
        for c in chunks:
            chunk_id = c.get("chunk_id") or c.get("id") or "unknown"
            content = c.get("content") or ""
            context_texts.append(f"Chunk ID: {chunk_id}\nContent: {content}")
        
        context_str = "\n---\n".join(context_texts)
        
        system_prompt = (
            "You are a factual claim extractor. Your job is to read the provided text chunks and extract atomic, self-contained factual statements (claims) that are directly relevant to answering the user query.\n"
            "Each claim must be independent and reference-free (do not use pronouns like 'he', 'they', or 'this system' without specifying what they refer to).\n"
            "Format the output strictly as a JSON array of objects, where each object has exactly two keys:\n"
            "- 'claim': The atomic factual statement.\n"
            "- 'chunk_id': The ID of the chunk from which this fact was extracted.\n"
            "If no relevant claims can be extracted, output []. Do not include any explanations, markdown code blocks, or extra text."
        )
        
        user_prompt = f"User Query: {query}\n\nText Chunks:\n{context_str}"
        
        claims = []
        try:
            response = self.generator.generate_direct(system_prompt, user_prompt)
            response = response.strip()
            
            # Robust JSON extraction
            match = re.search(r'\[.*\]', response, re.DOTALL)
            if match:
                response = match.group(0)
            else:
                raise ValueError(f"No JSON array found in response: {response}")
            
            parsed = json.loads(response)
            if isinstance(parsed, list):
                for item in parsed:
                    if isinstance(item, dict) and "claim" in item and "chunk_id" in item:
                        claim_text = str(item["claim"]).strip()
                        chunk_id = str(item["chunk_id"]).strip()
                        if claim_text and chunk_id:
                            claims.append(Claim(
                                claim=claim_text,
                                chunk_ids=[chunk_id],
                                subquery=query
                            ))
                return claims
            
            logger.warning("ClaimExtractor response was not a valid list: %s", response)
        except Exception as e:
            logger.warning("ClaimExtractor failed to extract claims: %s", e)
            
        return claims
