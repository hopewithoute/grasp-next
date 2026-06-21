def score_chunk(text: str) -> tuple[float, list[str]]:
    warnings: list[str] = []
    stripped = text.strip()
    token_estimate = max(1, len(stripped) // 4)

    if token_estimate < 20:
        warnings.append("too_short")
    if token_estimate > 1200:
        warnings.append("too_long")
    if len(set(stripped.lower().split())) < 8 and token_estimate > 20:
        warnings.append("low_information")

    score = 1.0 - min(0.8, len(warnings) * 0.25)
    return score, warnings
