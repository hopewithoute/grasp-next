from chonkie import SemanticChunker
from chonkie.refinery import OverlapRefinery

chunker = SemanticChunker(
    embedding_model="minishlab/potion-base-32M",
    chunk_size=16,
    similarity_window=2
)
refinery = OverlapRefinery(context_size=0.25, method="suffix")

text = "Vector quantization, a problem rooted in Shannon’s source coding theory, aims to quantize high-dimensional Euclidean vectors while minimizing distortion in their geometric structure. We propose TurboQuant to address both mean-squared error (MSE) and inner product distortion, overcoming limitations of existing methods that fail to achieve optimal distortion rates. Our data-oblivious algorithms, suitable for online applications, achieve near-optimal distortion rates (within a small constant factor) across all bit-widths and dimensions."

chunks = chunker(text)
refined = refinery(chunks)

print("RAW CHUNKS:")
for i, c in enumerate(chunks):
    print(f"[{i}]: {c.text}")

print("\nREFINED CHUNKS:")
for i, c in enumerate(refined):
    print(f"[{i}]: {c.text}")
