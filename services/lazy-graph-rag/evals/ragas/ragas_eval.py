import json
import os
import math
import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)

from pathlib import Path
from datasets import Dataset
from ragas import evaluate
from ragas.metrics import (
    AnswerRelevancy,
    faithfulness,
    context_precision,
    context_recall
)
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
def sanitize_for_json(obj):
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    elif isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_for_json(v) for v in obj]
    elif hasattr(obj, "item") and callable(obj.item):
        val = obj.item()
        if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
            return None
        return val
    return obj

def run_ragas_evaluation():
    results_path = Path("eval_results.json")
    if not results_path.exists():
        print(f"Error: {results_path} not found. Please run eval.py first.")
        return

    with open(results_path, "r") as f:
        data = json.load(f)

    if not data:
        print("No data found in eval_results.json.")
        return

    questions = []
    answers = []
    contexts = []
    ground_truths = []

    for item in data:
        questions.append(item["question"])
        answers.append(item["answer"])
        contexts.append(item["contexts"])
        ground_truths.append(item["referenceAnswer"])

    dataset_dict = {
        "question": questions,
        "answer": answers,
        "contexts": contexts,
        "ground_truth": ground_truths
    }

    eval_dataset = Dataset.from_dict(dataset_dict)
    
    gen_api_key = os.environ.get("GENERATOR_API_KEY")
    gen_base_url = os.environ.get("GENERATOR_BASE_URL")
    gen_model = os.environ.get("GENERATOR_MODEL")
    
    if not gen_api_key or not gen_base_url or not gen_model:
        print("Error: Missing required GENERATOR config (GENERATOR_API_KEY, GENERATOR_BASE_URL, GENERATOR_MODEL).")
        return
        
    print(f"Initializing Generator LLM ({gen_model})...")
    llm = ChatOpenAI(
        model=gen_model,
        api_key=gen_api_key,
        base_url=gen_base_url,
        max_retries=3
    )
    
    metrics = [
        faithfulness,
        context_precision,
        context_recall
    ]

    enable_relevancy = os.environ.get("RAGAS_ENABLE_ANSWER_RELEVANCY", "").lower() == "true"
    relevancy_strictness = int(os.environ.get("RAGAS_ANSWER_RELEVANCY_STRICTNESS", "1"))
    emb_api_key = os.environ.get("EMBEDDING_API_KEY")
    emb_base_url = os.environ.get("EMBEDDING_BASE_URL")
    emb_model = os.environ.get("EMBEDDING_MODEL")

    embeddings = None
    if enable_relevancy:
        if emb_api_key and emb_base_url and emb_model:
            print(f"Initializing Embedding model ({emb_model})...")
            embeddings = OpenAIEmbeddings(
                model=emb_model,
                api_key=emb_api_key,
                base_url=emb_base_url
            )
            metrics.append(AnswerRelevancy(strictness=relevancy_strictness, llm=llm, embeddings=embeddings))
        else:
            print("Warning: RAGAS_ENABLE_ANSWER_RELEVANCY is true but EMBEDDING_* envs are incomplete. Skipping answer_relevancy.")
    
    print("Running RAGAS evaluation...")
    
    # RAGAS >= 0.1 allows passing llm directly to evaluate
    try:
        print("Successfully initialized Ragas metrics!")
        
        # Run evaluation
        print("\n--- Running Ragas Evaluation ---")
        results = evaluate(eval_dataset, metrics=metrics, llm=llm, embeddings=embeddings, max_workers=2)
        
        print("\n--- RAGAS Evaluation Results ---")
        print(results)
        
        export_path = Path("ragas_scores.json")
        # Handle dict vs newer RAGAS result objects
        results_dict = results if isinstance(results, dict) else results.to_pandas().to_dict(orient="records")
        
        # Normalize NaN to None for JSON using the robust sanitizer
        clean_results = sanitize_for_json(results_dict)
                        
        with open(export_path, "w") as f:
            json.dump(clean_results, f, indent=2, allow_nan=False)
        print(f"\nDetailed results saved to {export_path.absolute()}")
        
    except Exception as e:
        print(f"Evaluation failed: {e}")

if __name__ == "__main__":
    run_ragas_evaluation()
