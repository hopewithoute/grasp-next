#!/bin/bash

echo "Running RAGBench Evaluation for Lite Mode..."
PYTHONUNBUFFERED=1 uv run --env-file ../../.env.eval python -u evals/ragbench/run_ragbench.py --budget lite | tee eval_lite.log
echo "Lite Mode Done!"

echo "Running RAGBench Evaluation for Balanced Mode..."
PYTHONUNBUFFERED=1 uv run --env-file ../../.env.eval python -u evals/ragbench/run_ragbench.py --budget balanced --skip-ingest | tee eval_balanced.log
echo "Balanced Mode Done!"

echo "Running RAGBench Evaluation for Deep Mode..."
PYTHONUNBUFFERED=1 uv run --env-file ../../.env.eval python -u evals/ragbench/run_ragbench.py --budget deep --skip-ingest | tee eval_deep.log
echo "Deep Mode Done!"

echo "All evaluations finished!"
