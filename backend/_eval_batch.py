import json, time, sys
from app.config import settings
from app.eval.run import evaluate, fmt
from app.rag import rerank as rr

results = {}
# Order matters: keep these names to match frontend consumer
runs = [
    ("baseline_dense", dict(use_hybrid=False, use_rerank=False,  rerank_model=None, baseline=True)),
    ("hybrid_no_rerank", dict(use_hybrid=True, use_rerank=False,  rerank_model=None, baseline=False)),
    ("minilm_full",     dict(use_hybrid=True, use_rerank=True,  rerank_model="Xenova/ms-marco-MiniLM-L-6-v2", baseline=False)),
    ("bge_rr_full",     dict(use_hybrid=True, use_rerank=True,  rerank_model="BAAI/bge-reranker-base",         baseline=False)),
    ("bge_rr_no_bm25",  dict(use_hybrid=False, use_rerank=True, rerank_model="BAAI/bge-reranker-base",         baseline=False)),
]

for name, cfg in runs:
    settings.use_hybrid = cfg["use_hybrid"]
    settings.use_rerank = cfg["use_rerank"]
    if cfg["rerank_model"]:
        settings.rerank_model = cfg["rerank_model"]
    rr._model = None  # force reload on each config
    t0 = time.perf_counter()
    r = evaluate(baseline=cfg["baseline"])
    dt = time.perf_counter() - t0
    r["_took_s"] = round(dt, 1)
    results[name] = r
    print(f"[{name:18s}] {fmt(r['metrics'])}  took={dt:.0f}s", flush=True)

with open("/home/cc/Documents/resume/agentbase/data/eval_report.json", "w") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)
print("wrote eval_report.json", flush=True)
