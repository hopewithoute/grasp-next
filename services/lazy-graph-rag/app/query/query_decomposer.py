from typing import List
import json
import logging
import re
from app.query.generator import create_generator, AnswerGenerator
from app.settings import get_settings

logger = logging.getLogger(__name__)

class QueryDecomposer:
    def __init__(self, generator: AnswerGenerator = None, test_mode: bool = False, settings=None):
        self.generator = generator or create_generator(force_test=test_mode)
        self.settings = settings or get_settings()

    def decompose(self, query: str, max_subqueries: int) -> List[str]:
        # If disabled by configuration or if max_subqueries <= 1, return the query as-is
        if not getattr(self.settings, "DECOMPOSER_ENABLED", True) or max_subqueries <= 1:
            return [query]
            
        system_prompt = (
            f"You are a search query decomposer. Your task is to break down a complex user query into a JSON array of up to {max_subqueries} simpler, atomic sub-queries that cover different aspects of the main query.\n"
            "Respond ONLY with a JSON array of strings. Do not include any explanations, markdown code blocks, or extra text.\n"
            "Example format: [\"sub-query 1\", \"sub-query 2\"]"
        )
        user_prompt = f"Decompose this query into at most {max_subqueries} sub-queries:\nQuery: {query}"
        
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
                # Ensure all elements are strings and limit to max_subqueries
                subqueries = [str(item).strip() for item in parsed if item]
                if subqueries:
                    return subqueries[:max_subqueries]
            
            logger.warning("QueryDecomposer parsed response was not a valid list: %s", response)
        except Exception as e:
            logger.warning("QueryDecomposer failed to decompose query: %s", e)
            
        return [query]
