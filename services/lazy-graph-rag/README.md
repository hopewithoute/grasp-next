# LazyGraphRAG

LazyGraphRAG is a retrieval-augmented generation (RAG) service with experimental graph-based retrieval capabilities.

## Evaluation

To evaluate the baseline generation quality using RAGAS, run the following pipeline. This requires `LGS_API_KEY` and the `GENERATOR_*` configs to be set in your `.env` file.

1. Ensure your local API server is running or start it manually.
2. Run the internal evaluation script to query the system and generate `eval_results.json`:
   ```bash
   rtk uv run python scripts/eval.py
   ```
3. Run the RAGAS measurement script in an isolated Python 3.12 environment to calculate default metrics (`faithfulness`, `context_precision`, `context_recall`):
   ```bash
   rtk uv run --no-project --python 3.12 --with ragas==0.1.22 --with datasets --with langchain-openai --with langchain-community==0.2.16 python scripts/ragas_eval.py
   ```
   *Note: To include `answer_relevancy`, set `RAGAS_ENABLE_ANSWER_RELEVANCY=true`. RAGAS will reuse the existing `EMBEDDING_*` config and defaults `RAGAS_ANSWER_RELEVANCY_STRICTNESS=1` for providers that do not support multi-completion `n > 1`.*
