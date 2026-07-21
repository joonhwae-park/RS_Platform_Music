import os, sys, json, time, torch, numpy as np, pandas as pd, random, logging
from typing import List, Dict, Tuple, Optional
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
import threading
import scipy.sparse as sp

# ===================== Logging =====================
logger = logging.getLogger()
logger.setLevel(logging.INFO)
for h in logger.handlers[:]:
    logger.removeHandler(h)
handler = logging.StreamHandler(sys.stdout)
handler.setLevel(logging.INFO)
handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
logger.addHandler(handler)

# ===================== Config (env) =====================
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET")

# Catalog: full candidate pool with metadata (spotify_track_id, music4all_id, artist, song).
# Loaded from the Supabase `audio_list` table at startup; local CSV is a fallback only.
AUDIO_LIST_TABLE = os.getenv("AUDIO_LIST_TABLE", "audio_list")
AUDIO_LIST_PATH = os.getenv("AUDIO_LIST_PATH", "/models/audio_list.csv")  # fallback

# Item-kNN serving artifacts (produced by item_knn_pipeline.py: --out <KNN_DIR>)
KNN_DIR = os.getenv("KNN_DIR", "/models/knn")

# TALLRec artifacts (base LLaMA-7B HF dir + trained LoRA adapter dir)
TALLREC_BASE = os.getenv("TALLREC_BASE", "/models/tallrec/llama-7b-hf")
TALLREC_LORA = os.getenv("TALLREC_LORA", "/models/tallrec/lora")
TALLREC_BATCH = int(os.getenv("TALLREC_BATCH", "8"))
TALLREC_MAX_LEN = int(os.getenv("TALLREC_MAX_LEN", "512"))
TALLREC_LOAD_8BIT = os.getenv("TALLREC_LOAD_8BIT", "1") == "1"
TALLREC_MAX_HISTORY = int(os.getenv("TALLREC_MAX_HISTORY", "20"))
# Cascade size: TALLRec reranks only the kNN top-N (latency budget: 30s on one L4).
# Measured ~6.3 samples/sec on L4 8-bit -> 100 ~= 16s (safe), 200 ~= 32s (borderline).
TALLREC_RERANK_POOL = int(os.getenv("TALLREC_RERANK_POOL", "100"))

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Token ids of "Yes"/"No" in the LLaMA-1 tokenizer (hardcoded in TALLRec's code)
YES_TOKEN_ID, NO_TOKEN_ID = 8241, 3782

random.seed(2026)
np.random.seed(2026)

# ===================== Client / App =====================
sb: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===================== Catalog =====================
# audio_list.csv: spotify_track_id, music4all_id, spotify_url, rating_count, artist, song, album_name
CATALOG: Optional[pd.DataFrame] = None
SPOTIFY2META: Dict[str, Dict] = {}   # spotify_track_id -> {music4all_id, artist, song, rating_count}

def _fetch_audio_list_table(page_size: int = 1000) -> pd.DataFrame:
    """Fetch the full `audio_list` table (paginated; supabase caps rows per request)."""
    rows, start = [], 0
    while True:
        r = sb.table(AUDIO_LIST_TABLE).select("*") \
            .range(start, start + page_size - 1).execute()
        chunk = r.data or []
        rows.extend(chunk)
        if len(chunk) < page_size:
            break
        start += page_size
    return pd.DataFrame(rows)

def load_catalog():
    global CATALOG, SPOTIFY2META
    try:
        logger.info(f"Loading catalog from Supabase table '{AUDIO_LIST_TABLE}'")
        df = _fetch_audio_list_table()
        logger.info(f"Fetched {len(df)} rows from '{AUDIO_LIST_TABLE}'")
    except Exception as e:
        logger.error(f"Table load failed ({e}); falling back to {AUDIO_LIST_PATH}")
        df = pd.read_csv(AUDIO_LIST_PATH)
    df["spotify_track_id"] = df["spotify_track_id"].astype(str)
    df["music4all_id"] = df["music4all_id"].astype(str)
    df = df.dropna(subset=["spotify_track_id", "music4all_id", "artist", "song"])
    df = df.drop_duplicates(subset=["spotify_track_id"])
    CATALOG = df.reset_index(drop=True)
    SPOTIFY2META = {
        r.spotify_track_id: {
            "music4all_id": r.music4all_id,
            "artist": str(r.artist),
            "song": str(r.song),
            "rating_count": float(getattr(r, "rating_count", 0) or 0),
        }
        for r in CATALOG.itertuples(index=False)
    }
    logger.info(f"Catalog loaded: {len(CATALOG)} tracks")

def item_repr(spotify_id: str) -> str:
    """Textual item representation; must match TALLRec training format."""
    m = SPOTIFY2META[spotify_id]
    return f"\"{m['song']}\" by {m['artist']}"

# ===================== Item-kNN =====================
# Artifacts from item_knn_implicit.py (implicit.nearest_neighbours.CosineRecommender):
#   implicit_cosine_knn.npz  -- similarity CSR stored as data/indices/indptr/shape (+ K)
#   item_ids.json            -- matrix index -> music4all_id
#   config.json              -- {"model": ..., "K": ..., ...}
# The npz is plain numpy (no pickle), so we reconstruct the CSR directly; if the
# keys ever differ (other implicit version), we fall back to implicit's own loader.
KNN_S: Optional[sp.csr_matrix] = None
KNN_ITEM_INDEX: Dict[str, int] = {}   # music4all_id -> matrix index
KNN_ITEM_IDS: Optional[np.ndarray] = None

def load_knn_assets():
    global KNN_S, KNN_ITEM_INDEX, KNN_ITEM_IDS
    npz_path = os.path.join(KNN_DIR, "implicit_cosine_knn.npz")
    logger.info(f"Loading item-kNN artifacts from {KNN_DIR}")
    try:
        with np.load(npz_path, allow_pickle=False) as z:
            if not {"data", "indices", "indptr", "shape"} <= set(z.files):
                raise KeyError(f"unexpected npz keys: {sorted(z.files)}")
            KNN_S = sp.csr_matrix(
                (z["data"], z["indices"], z["indptr"]), shape=tuple(z["shape"])
            )
    except Exception as e:
        logger.warning(f"Manual npz load failed ({e}); falling back to implicit loader")
        from implicit.nearest_neighbours import CosineRecommender
        KNN_S = CosineRecommender.load(npz_path).similarity.tocsr()

    with open(os.path.join(KNN_DIR, "item_ids.json")) as f:
        KNN_ITEM_IDS = np.asarray(json.load(f))
    KNN_ITEM_INDEX = {iid: j for j, iid in enumerate(KNN_ITEM_IDS)}
    if KNN_S.shape[0] != len(KNN_ITEM_IDS):
        raise ValueError(f"similarity shape {KNN_S.shape} != item_ids {len(KNN_ITEM_IDS)}")
    with open(os.path.join(KNN_DIR, "config.json")) as f:
        cfg = json.load(f)
    logger.info(f"item-kNN loaded: {KNN_S.shape[0]} items, nnz={KNN_S.nnz}, K={cfg.get('K')}")

def score_candidates_knn(history: List[Dict], cand_ids: List[str]) -> List[Tuple[str, float]]:
    """Fold-in scoring: scores = r @ S with r in {+1, -1} over the item axis.

    Direction matters: the pruned similarity is asymmetric, and both implicit's
    recommend() and the offline evaluation (rank_holdout) use r @ S.
    history: [{spotify_track_id, rating(1|0)}]; cand_ids: candidate spotify ids.
    Ties at score <= 0 are broken by catalog popularity (rating_count) so the
    top-20 pool stays sensible even when neighbor overlap is sparse.
    """
    cols, vals = [], []
    for h in history:
        meta = SPOTIFY2META.get(h["spotify_track_id"])
        if meta is None:
            continue
        j = KNN_ITEM_INDEX.get(meta["music4all_id"])
        if j is None:
            continue
        cols.append(j)
        vals.append(1.0 if int(h["rating"]) == 1 else -1.0)
    if not cols:
        logger.warning("kNN: no history items mapped to the similarity matrix")
        return []

    r = sp.csr_matrix((vals, ([0] * len(cols), cols)), shape=(1, len(KNN_ITEM_IDS)), dtype=np.float32)
    scores = np.asarray((r @ KNN_S).todense()).ravel()

    out = []
    for cid in cand_ids:
        meta = SPOTIFY2META.get(cid)
        j = KNN_ITEM_INDEX.get(meta["music4all_id"]) if meta else None
        s = float(scores[j]) if j is not None else 0.0
        out.append((cid, s, meta["rating_count"] if meta else 0.0))

    out.sort(key=lambda x: (x[1], x[2]), reverse=True)
    n_pos = sum(1 for _, s, _ in out if s > 0)
    logger.info(f"kNN scored {len(out)} candidates ({n_pos} with positive score)")
    return [(cid, s) for cid, s, _ in out]

# ===================== TALLRec =====================
TALLREC_MODEL = None
TALLREC_TOKENIZER = None

# Alpaca template exactly as in TALLRec finetune_rec.py / evaluate.py
# (including the literal '# noqa: E501' which was part of the training prompts).
TALLREC_TEMPLATE = (
    "Below is an instruction that describes a task, paired with an input that provides further context. "
    "Write a response that appropriately completes the request.  # noqa: E501\n"
    "\n"
    "### Instruction:\n"
    "{instruction}\n"
    "\n"
    "### Input:\n"
    "{input}\n"
    "\n"
    "### Response:\n"
)
TALLREC_INSTRUCTION = (
    "Given the user's preference and unpreference, identify whether the user "
    "will like the target music by answering \"Yes.\" or \"No.\"."
)

def load_tallrec_once():
    global TALLREC_MODEL, TALLREC_TOKENIZER
    if TALLREC_MODEL is not None:
        return
    from transformers import LlamaForCausalLM, LlamaTokenizer
    from peft import PeftModel

    logger.info(f"Loading TALLRec base model from {TALLREC_BASE} (8bit={TALLREC_LOAD_8BIT})")
    TALLREC_TOKENIZER = LlamaTokenizer.from_pretrained(TALLREC_BASE)
    TALLREC_TOKENIZER.pad_token_id = 0
    TALLREC_TOKENIZER.padding_side = "left"  # align last position for batched next-token scoring

    if TALLREC_LOAD_8BIT:
        base = LlamaForCausalLM.from_pretrained(
            TALLREC_BASE, load_in_8bit=True, torch_dtype=torch.float16, device_map="auto"
        )
    else:
        base = LlamaForCausalLM.from_pretrained(
            TALLREC_BASE, torch_dtype=torch.float16, device_map="auto"
        )

    logger.info(f"Loading TALLRec LoRA adapter from {TALLREC_LORA}")
    model = PeftModel.from_pretrained(base, TALLREC_LORA, torch_dtype=torch.float16)
    model.eval()
    TALLREC_MODEL = model

    # Sanity check: the hardcoded ids must decode to "Yes"/"No"
    dec = TALLREC_TOKENIZER.convert_ids_to_tokens([YES_TOKEN_ID, NO_TOKEN_ID])
    logger.info(f"TALLRec loaded. Token check: {YES_TOKEN_ID}->{dec[0]}, {NO_TOKEN_ID}->{dec[1]}")

def make_tallrec_prompt(liked: List[str], disliked: List[str], target: str) -> str:
    pref = ", ".join(liked) if liked else "None"
    unpref = ", ".join(disliked) if disliked else "None"
    task_input = (
        f"User Preference: {pref}\n"
        f"User Unpreference: {unpref}\n"
        f"Whether the user will like the target music {target}?"
    )
    return TALLREC_TEMPLATE.format(instruction=TALLREC_INSTRUCTION, input=task_input)

@torch.no_grad()
def score_candidates_tallrec(history: List[Dict], cand_ids: List[str]) -> List[Tuple[str, float]]:
    """Score each candidate with P(Yes) at the first response token.

    Equivalent to TALLRec evaluate.py: softmax over logits of token ids
    [NO, YES] at the position right after '### Response:\\n'.
    """
    # Chronological history (oldest -> newest), capped like training (max_history)
    hist = sorted(history, key=lambda h: h.get("created_at") or "")
    liked = [item_repr(h["spotify_track_id"]) for h in hist
             if int(h["rating"]) == 1 and h["spotify_track_id"] in SPOTIFY2META][-TALLREC_MAX_HISTORY:]
    disliked = [item_repr(h["spotify_track_id"]) for h in hist
                if int(h["rating"]) == 0 and h["spotify_track_id"] in SPOTIFY2META][-TALLREC_MAX_HISTORY:]

    prompts = [make_tallrec_prompt(liked, disliked, item_repr(cid)) for cid in cand_ids]
    logger.info(f"TALLRec scoring {len(prompts)} candidates (batch={TALLREC_BATCH})")

    probs: List[float] = []
    for s in range(0, len(prompts), TALLREC_BATCH):
        batch = prompts[s:s + TALLREC_BATCH]
        enc = TALLREC_TOKENIZER(
            batch, return_tensors="pt", padding=True, truncation=True, max_length=TALLREC_MAX_LEN
        ).to(TALLREC_MODEL.device)
        logits = TALLREC_MODEL(**enc).logits[:, -1, :]                # next-token logits
        yn = logits[:, [NO_TOKEN_ID, YES_TOKEN_ID]].float().softmax(dim=-1)
        probs.extend(yn[:, 1].tolist())                               # P(Yes)
        if s == 0:
            logger.info(f"Sample prompt (truncated): {batch[0][:200]}...")

    scored = list(zip(cand_ids, probs))
    logger.info(f"TALLRec scoring done. P(Yes): min={min(probs):.3f} max={max(probs):.3f} mean={np.mean(probs):.3f}")
    return scored

# ===================== Supabase I/O =====================
def get_history(session_id: str, limit: int = 100) -> List[Dict]:
    """Phase-1 binary ratings for the session."""
    try:
        logger.info(f"Fetching phase-1 ratings for session {session_id}")
        r = sb.table("song_ratings") \
            .select("spotify_track_id,rating,created_at") \
            .eq("session_id", session_id) \
            .eq("phase", 1) \
            .order("created_at", desc=False) \
            .limit(limit).execute()
        history = r.data or []
        logger.info(f"Retrieved {len(history)} phase-1 ratings")
        return history
    except Exception as e:
        logger.error(f"Failed to fetch history for session {session_id}: {e}")
        return []

def get_rated_ids(session_id: str) -> List[str]:
    """All track ids this session has already rated (any phase, incl. attention checks)."""
    try:
        r = sb.table("song_ratings").select("spotify_track_id").eq("session_id", session_id).execute()
        return list({row["spotify_track_id"] for row in (r.data or [])})
    except Exception as e:
        logger.error(f"Failed to fetch rated ids: {e}")
        return []

def get_candidates(exclude_ids: List[str]) -> List[str]:
    """Candidate pool = full catalog minus already-rated tracks."""
    excl = set(exclude_ids)
    cands = [cid for cid in SPOTIFY2META.keys() if cid not in excl]
    logger.info(f"Candidates: {len(cands)} (excluded {len(excl)} rated tracks)")
    return cands

def rows_from_scored(session_id: str, model: str, scored: List[Tuple[str, float]],
                     topk: int, batch: int) -> List[Dict]:
    """Keep the model's internal top-K as rank 1..K; display_order filled later."""
    top = sorted(scored, key=lambda x: x[1], reverse=True)[:topk]
    rows = []
    for i, (tid, sc) in enumerate(top):
        rows.append({
            "session_id": session_id,
            "spotify_track_id": tid,
            "score": float(sc),
            "model": model,
            "batch": batch,
            "rank": i + 1,
            "display_order": None,
        })
    logger.info(f"Created {len(rows)} rows for model {model}")
    return rows

def upsert_rows(rows: List[Dict]):
    if not rows:
        return
    try:
        session_id, model, batch = rows[0]["session_id"], rows[0]["model"], rows[0]["batch"]
        logger.info(f"Upserting {len(rows)} rows for ({session_id}, {model}, batch={batch})")
        sb.table("music_recommendations").delete() \
            .eq("session_id", session_id).eq("model", model).eq("batch", batch).execute()
        sb.table("music_recommendations").insert(rows).execute()
        logger.info("Rows inserted successfully")
    except Exception as e:
        logger.error(f"Failed to upsert rows: {e}")
        raise

# ===================== Display order =====================
def build_display_sequence(tallrec_top: List[Tuple[str, float]],
                           knn_top: List[Tuple[str, float]],
                           per_model: int = 10) -> List[Tuple[str, str, int]]:
    """Interleave the two ranked lists into 2*per_model display slots.

    - Starting model is chosen at random, then turns strictly alternate.
    - On each turn, the model contributes its highest-ranked track not shown
      yet (duplicates across models are skipped -> the top-20 pools serve as backup).
    - If one pool is exhausted, the other fills the remaining slots.
    Returns [(model, spotify_track_id, display_order 1..2*per_model)].
    """
    lists = {"tallrec": [t for t, _ in tallrec_top], "item_knn": [t for t, _ in knn_top]}
    idx = {"tallrec": 0, "item_knn": 0}
    taken = {"tallrec": 0, "item_knn": 0}
    used = set()
    seq: List[Tuple[str, str, int]] = []
    total = 2 * per_model

    turn = random.choice(["tallrec", "item_knn"])
    logger.info(f"Building display sequence starting with {turn}")

    while len(seq) < total:
        other = "item_knn" if turn == "tallrec" else "tallrec"
        cur = turn if taken[turn] < per_model else other  # fill from the other side if quota met
        lst = lists[cur]
        while idx[cur] < len(lst) and lst[idx[cur]] in used:
            idx[cur] += 1  # skip tracks already displayed
        if idx[cur] < len(lst):
            tid = lst[idx[cur]]
            seq.append((cur, tid, len(seq) + 1))
            used.add(tid)
            taken[cur] += 1
            idx[cur] += 1
        elif idx[other] >= len(lists[other]):
            break  # both pools exhausted
        turn = other

    logger.info(f"Display sequence: {len(seq)} tracks "
                f"(tallrec={taken['tallrec']}, item_knn={taken['item_knn']})")
    return seq

# ===================== API =====================
class RecReq(BaseModel):
    session_id: str
    batch: int = 1
    pool_per_model: int = 20               # internal top-K per model (backup for duplicate skipping)
    display_per_model: int = 10            # displayed items per model (total = 2x)
    rerank_pool: Optional[int] = None      # kNN top-N that TALLRec reranks (default: env TALLREC_RERANK_POOL)

READY = {"ok": False, "msg": "booting"}

def _heavy_init():
    """Initialize models in a background thread; serve kNN-only until TALLRec is up."""
    try:
        logger.info("Starting heavy initialization...")
        required = ["SUPABASE_URL", "SUPABASE_SERVICE_KEY"]
        missing = [k for k in required if not os.getenv(k)]
        if missing:
            raise RuntimeError(f"Missing env: {', '.join(missing)}")

        load_catalog()
        load_knn_assets()
        READY.update(ok=True, msg="ready_basic")   # kNN-only capability
        logger.info("Basic initialization complete (catalog + item-kNN)")

        logger.info("Loading TALLRec (heavy)...")
        load_tallrec_once()
        READY.update(ok=True, msg="ready_full")
        logger.info("Full initialization completed successfully")
    except Exception as e:
        READY.update(ok=READY["ok"], msg=f"init_error: {e}")
        logger.error(f"Heavy initialization failed: {e}")
        import traceback
        logger.error(traceback.format_exc())

@app.on_event("startup")
def _startup():
    logger.info("FastAPI startup event triggered")
    threading.Thread(target=_heavy_init, daemon=True).start()

@app.get("/health")
def health():
    return {
        "ok": READY["ok"],
        "status": READY["msg"],
        "device": DEVICE,
        "knn_dir": KNN_DIR,
        "tallrec_lora": TALLREC_LORA,
        "tallrec_rerank_pool": TALLREC_RERANK_POOL,
        "n_items": int(len(SPOTIFY2META)),
    }

@app.post("/recommend")
def recommend(req: RecReq, x_webhook_secret: Optional[str] = Header(None)):
    logger.info(f"Recommendation request for session {req.session_id} (status={READY['msg']})")

    if not READY["ok"]:
        raise HTTPException(503, "warming up")
    if WEBHOOK_SECRET and x_webhook_secret != WEBHOOK_SECRET:
        raise HTTPException(401, "bad secret")

    use_tallrec = (READY["msg"] == "ready_full" and TALLREC_MODEL is not None)
    if not use_tallrec:
        logger.warning("TALLRec not fully loaded, will use kNN-only recommendations")

    try:
        # 1) Input acquisition
        logger.info("Step 1: Acquiring input data")
        hist = get_history(req.session_id)
        if not hist:
            raise HTTPException(400, "No rating history for the given session_id.")

        rated = get_rated_ids(req.session_id)
        candidates = get_candidates(exclude_ids=rated)
        if not candidates:
            raise HTTPException(400, "No candidates left after excluding rated tracks.")

        # 2) item-kNN: score ALL candidates, keep internal top pool
        logger.info("Step 2: Computing item-kNN recommendations")
        t_knn = time.time()
        knn_scored = score_candidates_knn(hist, candidates)   # sorted desc
        knn_rows = rows_from_scored(req.session_id, "item_knn", knn_scored,
                                    topk=req.pool_per_model, batch=req.batch)
        knn_secs = time.time() - t_knn

        # 3) TALLRec: rerank only the kNN top-N (cascade, 30s latency budget)
        tallrec_rows, tallrec_secs = [], 0.0
        if use_tallrec:
            try:
                n_rerank = req.rerank_pool or TALLREC_RERANK_POOL
                rerank_ids = [tid for tid, _ in knn_scored[:n_rerank]]
                logger.info(f"Step 3: TALLRec reranking kNN top-{len(rerank_ids)}")
                t_tal = time.time()
                tallrec_scored = score_candidates_tallrec(hist, rerank_ids)
                tallrec_secs = time.time() - t_tal
                logger.info(f"TALLRec rerank took {tallrec_secs:.1f}s "
                            f"({len(rerank_ids) / max(tallrec_secs, 1e-9):.1f} samples/sec)")
                tallrec_rows = rows_from_scored(req.session_id, "tallrec", tallrec_scored,
                                                topk=req.pool_per_model, batch=req.batch)
            except Exception as e:
                logger.error(f"TALLRec processing failed, continuing with kNN only: {e}")
                import traceback
                logger.error(traceback.format_exc())
                tallrec_rows = []

        # 4) Display order (interleaved, random start, duplicate skipping)
        logger.info("Step 4: Building display sequence")
        knn_pool = [(r["spotify_track_id"], r["score"]) for r in sorted(knn_rows, key=lambda x: x["rank"])]
        if tallrec_rows:
            tallrec_pool = [(r["spotify_track_id"], r["score"]) for r in sorted(tallrec_rows, key=lambda x: x["rank"])]
            display_seq = build_display_sequence(tallrec_pool, knn_pool, per_model=req.display_per_model)
        else:
            display_seq = [("item_knn", tid, i + 1)
                           for i, (tid, _) in enumerate(knn_pool[:req.display_per_model])]

        # 5) Apply display order
        logger.info("Step 5: Applying display order")
        disp_map = {(m, tid): order for (m, tid, order) in display_seq}
        for r in tallrec_rows:
            r["display_order"] = disp_map.get(("tallrec", r["spotify_track_id"]))
        for r in knn_rows:
            r["display_order"] = disp_map.get(("item_knn", r["spotify_track_id"]))
        n_displayed = sum(1 for r in (tallrec_rows + knn_rows) if r.get("display_order") is not None)
        logger.info(f"Assigned display_order to {n_displayed} tracks")

        # 6) Persist — displayed rows only.
        # music_recommendations.display_order is NOT NULL, and the frontend
        # (App.tsx loadPhase2Songs) renders every stored row for the session,
        # so the internal top-20 pools must not be written to the table.
        logger.info("Step 6: Saving recommendations to database")
        tallrec_saved = [r for r in tallrec_rows if r.get("display_order") is not None]
        knn_saved = [r for r in knn_rows if r.get("display_order") is not None]
        if tallrec_saved:
            upsert_rows(tallrec_saved)
        upsert_rows(knn_saved)

        result = {
            "session_id": req.session_id,
            "batch": req.batch,
            "tallrec_saved": len(tallrec_saved),
            "knn_saved": len(knn_saved),
            "displayed": n_displayed,
            "display_sequence": display_seq,
            "timing": {"knn_secs": round(knn_secs, 2), "tallrec_secs": round(tallrec_secs, 2)},
        }
        logger.info(f"Recommendation generation completed for session {req.session_id}")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error during recommendation generation: {e}")
        raise HTTPException(500, f"Internal server error: {str(e)}")
