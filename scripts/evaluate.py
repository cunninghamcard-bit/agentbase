#!/usr/bin/env python3
"""LLM-as-Judge evaluation for AgentBase RAG system."""
import asyncio
import json
import os
from pathlib import Path

import aiohttp

BASE_DIR = Path(__file__).resolve().parent.parent
EVAL_PATH = BASE_DIR / "eval" / "questions.jsonl"
RESULT_PATH = BASE_DIR / "eval" / "results.jsonl"
RESULT_PATH.parent.mkdir(parents=True, exist_ok=True)

API_KEY = os.getenv("LLM_API_KEY", "")
API_BASE = os.getenv("LLM_API_BASE", "https://api.openai.com/v1")
MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")

JUDGE_PROMPT = """You are a strict evaluator. Given a QUESTION, a REFERENCE ANSWER, and a MODEL ANSWER, score the model answer on a scale of 0-5.

Scoring:
- 5: Completely correct and comprehensive.
- 4: Mostly correct, minor omissions.
- 3: Partially correct, significant omissions or minor errors.
- 2: Noticeably wrong or largely incomplete.
- 1: Completely wrong.
- 0: Refuses to answer or nonsense.

Output ONLY an integer 0-5, nothing else.

Question: {question}
Reference Answer: {reference}
Model Answer: {answer}
Score:"""


QUESTIONS = [
    {"question": "What is ReAct prompting and how does it differ from Chain-of-Thought?", "reference": "ReAct combines reasoning traces (CoT) with action execution, allowing LLMs to interact with external tools. CoT only produces reasoning without actions."},
    {"question": "When was AutoGen first released by Microsoft?", "reference": "AutoGen was first released by Microsoft in 2023."},
    {"question": "What are the main components of a typical LLM-based agent architecture?", "reference": "A typical LLM-based agent consists of a planning module, a memory module (short-term and long-term), and a tool-use / action module."},
    {"question": "What is the 'ToolFormer' approach proposed by Meta?", "reference": "ToolFormer is a method to teach LLMs to use external tools via API calls in a self-supervised way, using sampling and filtering."},
    {"question": "In multi-agent systems, what is the difference between cooperative and competitive agents?", "reference": "Cooperative agents share a common goal and collaborate, while competitive agents have conflicting objectives and may deceive or oppose each other."},
    {"question": "What is the purpose of an Agent 'memory' module?", "reference": "The memory module stores past interactions, knowledge, and context to enable consistent and informed future behavior."},
    {"question": "What does 'grounding' mean in the context of RAG systems?", "reference": "Grounding means the generated response is supported by retrieved evidence/documents, reducing hallucination."},
    {"question": "What is the primary challenge of 'context window' limitations for agent systems?", "reference": "Long agent trajectories can exceed the LLM's context window, requiring summarization, compression, or selective memory retrieval."},
    {"question": "How does LangGraph differ from basic LangChain?", "reference": "LangGraph adds cyclic graph structures and state management for building multi-step agent workflows, while LangChain is primarily linear."},
    {"question": "What is 'in-context learning' and why is it important for agents?", "reference": "In-context learning is the ability of LLMs to learn from examples provided in the prompt, enabling agents to adapt to new tasks without fine-tuning."},
]


async def judge(session: aiohttp.ClientSession, q: str, ref: str, ans: str) -> int:
    prompt = JUDGE_PROMPT.format(question=q, reference=ref, answer=ans)
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.0,
    }
    headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
    try:
        async with session.post(f"{API_BASE}/chat/completions", json=payload, headers=headers) as resp:
            resp.raise_for_status()
            data = await resp.json()
            text = data["choices"][0]["message"]["content"].strip()
            # Extract first integer
            for token in text.split():
                if token.isdigit():
                    return min(5, max(0, int(token)))
            return 0
    except Exception as e:
        print(f"Judge error: {e}")
        return 0


async def main():
    if not API_KEY:
        print("Error: set LLM_API_KEY env variable.")
        return

    # Save questions if not exists
    if not EVAL_PATH.exists():
        with open(EVAL_PATH, "w", encoding="utf-8") as f:
            for q in QUESTIONS:
                f.write(json.dumps(q, ensure_ascii=False) + "\n")
        print(f"Wrote {len(QUESTIONS)} questions to {EVAL_PATH}")

    questions = []
    with open(EVAL_PATH, "r", encoding="utf-8") as f:
        for line in f:
            try:
                questions.append(json.loads(line))
            except json.JSONDecodeError:
                pass

    print(f"Evaluating {len(questions)} questions...")
    semaphore = asyncio.Semaphore(5)

    async with aiohttp.ClientSession() as session:
        async def eval_one(q):
            async with semaphore:
                # TODO: replace with actual RAGFlow ask call
                # For now, we use the judge itself as a placeholder model
                placeholder_answer = "This is a placeholder answer. Replace with RAGFlow response."
                score = await judge(session, q["question"], q.get("reference", ""), placeholder_answer)
                result = {
                    "question": q["question"],
                    "reference": q.get("reference", ""),
                    "answer": placeholder_answer,
                    "score": score,
                }
                with open(RESULT_PATH, "a", encoding="utf-8") as f:
                    f.write(json.dumps(result, ensure_ascii=False) + "\n")
                print(f"  {q['question'][:50]}... -> {score}/5")
                return score

        scores = await asyncio.gather(*[eval_one(q) for q in questions])

    avg = sum(scores) / len(scores) if scores else 0
    accuracy = sum(1 for s in scores if s >= 4) / len(scores) * 100 if scores else 0
    print(f"\nAverage score: {avg:.2f}/5")
    print(f"Accuracy (≥4): {accuracy:.1f}%")


if __name__ == "__main__":
    asyncio.run(main())
