from typing import List, Dict, Any

def compute_rrf(ranked_lists: List[List[str]], k: int = 60) -> List[Dict[str, Any]]:
    """
    Computes Reciprocal Rank Fusion.
    ranked_lists: a list of lists. Each inner list contains chunk IDs ordered by rank (best first).
    Returns a sorted list of dictionaries with chunk_id and rrf_score.
    """
    from collections import defaultdict
    rrf_scores = defaultdict(float)
    
    for r_list in ranked_lists:
        for rank, chunk_id in enumerate(r_list, start=1):
            rrf_scores[chunk_id] += 1.0 / (rank + k)
            
    # Sort by score descending
    sorted_results = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
    return [{"chunk_id": chunk_id, "rrf_score": score} for chunk_id, score in sorted_results]
