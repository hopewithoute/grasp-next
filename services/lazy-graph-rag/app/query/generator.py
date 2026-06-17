from typing import List
from app.query.models import RetrievedContext, Claim

class AnswerGenerator:
    def generate_answer(self, query: str, contexts: List[RetrievedContext]) -> str:
        raise NotImplementedError

    def generate_direct(self, system_prompt: str, user_prompt: str) -> str:
        raise NotImplementedError

    def generate_partial_answer(self, subquery: str, claims: List[Claim]) -> str:
        raise NotImplementedError

    def reduce_answers(self, query: str, partial_answers: List[str]) -> str:
        raise NotImplementedError

class DeterministicTestGenerator(AnswerGenerator):
    def __init__(self, fixed_answer: str = "This is a deterministic answer based on the context."):
        self.fixed_answer = fixed_answer

    def generate_answer(self, query: str, contexts: List[RetrievedContext]) -> str:
        if not contexts:
            return "No context provided to answer the query."
        # Optionally could inspect query, but for deterministic test adapter, just return fixed
        if "pgvector" in query.lower():
            return "pgvector provides vector similarity search in PostgreSQL."
        return self.fixed_answer

    def generate_direct(self, system_prompt: str, user_prompt: str) -> str:
        # Mock behavior for testing
        if "decompose" in system_prompt.lower() or "decompose" in user_prompt.lower():
            if "pgvector" in user_prompt.lower():
                return '["what is pgvector", "pgvector performance in postgresql"]'
            return '["subquery 1", "subquery 2"]'
        if "extract" in system_prompt.lower() or "extract" in user_prompt.lower():
            return '[{"claim": "Claim 1 extracted", "chunk_id": "c1"}, {"claim": "Claim 2 extracted", "chunk_id": "c2"}]'
        if "reduce" in system_prompt.lower() or "reduce" in user_prompt.lower():
            return "This is the reduced final answer."
        return self.fixed_answer

    def generate_partial_answer(self, subquery: str, claims: List[Claim]) -> str:
        if not claims:
            return "No relevant information found for this sub-query."
        return f"Partial answer for: {subquery} based on {len(claims)} claims."

    def reduce_answers(self, query: str, partial_answers: List[str]) -> str:
        return f"Reduced final answer for: {query} with {len(partial_answers)} parts."

import httpx
from app.settings import Settings, get_settings

class OpenAIGenerator(AnswerGenerator):
    def __init__(self, settings: Settings):
        self.model = settings.GENERATOR_MODEL
        url = settings.GENERATOR_BASE_URL or "https://api.openai.com/v1"
        self.url = f"{url.rstrip('/')}/chat/completions"
        self.token = settings.GENERATOR_API_KEY
        if not self.token:
            raise RuntimeError("GENERATOR_API_KEY is not configured and is required for OpenAIGenerator")
        
    def generate_answer(self, query: str, contexts: List[RetrievedContext]) -> str:
        if not contexts:
            return "I don't have enough context to answer that."
            
        system_prompt = "You are a helpful assistant. Use the following context to answer the user's question. Be concise and accurate."
        
        context_texts = []
        for ctx in contexts:
            context_texts.append(f"Document {ctx.documentId} (Chunk {ctx.chunkId}):\n{ctx.content}")
        
        context_str = "\n\n".join(context_texts)
        user_prompt = f"Context:\n{context_str}\n\nQuestion:\n{query}"
        
        return self.generate_direct(system_prompt, user_prompt)

    def generate_direct(self, system_prompt: str, user_prompt: str) -> str:
        headers = {
            "Content-Type": "application/json",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
            
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.0
        }
        
        try:
            with httpx.Client() as client:
                response = client.post(self.url, json=payload, headers=headers, timeout=60.0)
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
        except httpx.HTTPStatusError as exc:
            print("HTTP Error:", exc.response.text)
            raise RuntimeError(f"Generator inference failed: {exc.response.text}") from exc
        except Exception as exc:
            raise RuntimeError(f"Generator inference failed: {exc}") from exc

    def generate_partial_answer(self, subquery: str, claims: List[Claim]) -> str:
        if not claims:
            return "No relevant information found for this sub-query."
            
        claim_texts = [f"- {c.claim}" for c in claims]
        context_str = "\n".join(claim_texts)
        
        system_prompt = "You are a helpful assistant. Use the provided factual claims to write a concise, accurate partial answer to the sub-query."
        user_prompt = f"Claims:\n{context_str}\n\nSub-query:\n{subquery}"
        
        return self.generate_direct(system_prompt, user_prompt)

    def reduce_answers(self, query: str, partial_answers: List[str]) -> str:
        if not partial_answers:
            return "I don't have enough context to answer that."
            
        answers_str = "\n\n---\n\n".join(partial_answers)
        
        system_prompt = "You are a synthesis assistant. Your task is to combine multiple partial answers into a single, coherent, well-structured, and comprehensive answer to the main query. Eliminate redundancies and make the final text flow logically."
        user_prompt = f"Main Query: {query}\n\nPartial Answers:\n{answers_str}"
        
        return self.generate_direct(system_prompt, user_prompt)

def create_generator(settings: Settings = None, force_test: bool = False) -> AnswerGenerator:
    settings = settings or get_settings()
    if force_test:
        return DeterministicTestGenerator()
    return OpenAIGenerator(settings)
