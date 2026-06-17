import pytest
from app.query.claim_aggregator import ClaimAggregator
from app.query.models import Claim

def test_claim_aggregator_no_duplicates():
    aggregator = ClaimAggregator(threshold=0.8)
    claims = [
        Claim(claim="The dog barked at the cat.", chunk_ids=["c1"], subquery="dogs"),
        Claim(claim="The weather is sunny today.", chunk_ids=["c2"], subquery="weather")
    ]
    
    result = aggregator.aggregate(claims)
    assert len(result) == 2
    assert result[0].claim == "The dog barked at the cat."
    assert result[0].chunk_ids == ["c1"]
    assert result[1].claim == "The weather is sunny today."
    assert result[1].chunk_ids == ["c2"]

def test_claim_aggregator_merges_duplicates():
    aggregator = ClaimAggregator(threshold=0.8)
    claims = [
        Claim(claim="The dog barked at the cat.", chunk_ids=["c1"], subquery="dogs"),
        Claim(claim="The dog barked at the cat!", chunk_ids=["c2"], subquery="dogs"),
        Claim(claim="the dog barked at the cat.", chunk_ids=["c3"], subquery="dogs")
    ]
    
    result = aggregator.aggregate(claims)
    assert len(result) == 1
    assert result[0].claim == "The dog barked at the cat."
    # Chunk IDs should be unique and merged
    assert sorted(result[0].chunk_ids) == ["c1", "c2", "c3"]

def test_claim_aggregator_fuzzy_similarity():
    aggregator = ClaimAggregator(threshold=0.8)
    # These two statements are highly similar and should be merged
    claims = [
        Claim(claim="Artificial intelligence will change the world.", chunk_ids=["c1"], subquery="ai"),
        Claim(claim="AI will change the world.", chunk_ids=["c2"], subquery="ai") # threshold might need to be hit, let's see ratio:
        # "Artificial intelligence will change the world" vs "AI will change the world"
        # "artificial intelligence will change the world" vs "ai will change the world"
        # Ratio might be low because "artificial intelligence" vs "ai" is quite different in string match.
        # Let's test with closer ones, e.g. "Artificial intelligence changes the world"
    ]
    
    # Let's use two that are very close
    claims_similar = [
        Claim(claim="Artificial intelligence will change the world.", chunk_ids=["c1"], subquery="ai"),
        Claim(claim="Artificial intelligence will change the world!", chunk_ids=["c2"], subquery="ai"),
        Claim(claim="Artificial intelligence changes the world.", chunk_ids=["c3"], subquery="ai")
    ]
    
    result = aggregator.aggregate(claims_similar)
    assert len(result) == 1
    assert sorted(result[0].chunk_ids) == ["c1", "c2", "c3"]
