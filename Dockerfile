FROM mambaorg/micromamba:1.5.8
USER root

RUN apt-get update && apt-get install -y \
    git build-essential && \
    rm -rf /var/lib/apt/lists/*

COPY tallrec.yml /tmp/tallrec.yml
RUN sed -i '/^prefix:/d' /tmp/tallrec.yml

RUN micromamba create -y -n tallrec -f /tmp/tallrec.yml && \
    micromamba clean -a -y

ENV MAMBA_DOCKERFILE_ACTIVATE=1
SHELL ["/bin/bash", "-lc"]

# torch first (CUDA 11.8 wheel: native sm_89 kernels for the L4 GPU),
# then the torch-dependent packages, pinned to the combo validated during
# TALLRec training/evaluation (transformers 4.28 + old-format LoRA adapter).
RUN micromamba run -n tallrec python -m pip install --upgrade pip && \
    micromamba run -n tallrec pip install --no-cache-dir \
      --index-url https://download.pytorch.org/whl/cu118 \
      torch==2.0.1+cu118

RUN micromamba run -n tallrec pip install --no-cache-dir \
      accelerate==0.26.1 \
      bitsandbytes==0.42.0 \
      nvidia-cusparse-cu11==11.7.4.91 \
      "peft @ git+https://github.com/huggingface/peft.git@e536616888d51b453ed354a6f1e243fecb02ea08"

# bitsandbytes' CUDA binary (libbitsandbytes_cuda118.so) links against CUDA
# runtime libs (libcudart / libcusparse / libcublas) that the pip torch wheel
# bundles inside site-packages. Cloud Run injects only the GPU *driver*, so
# register those bundled lib dirs with ldconfig, then verify at BUILD time
# that every dependency of the bnb binary resolves (fail the build otherwise).
RUN micromamba run -n tallrec python -c "\
import glob, os, site; sp = site.getsitepackages()[0]; \
pats = ['torch/lib/lib*.so*', 'nvidia/*/lib/lib*.so*']; \
dirs = sorted({os.path.dirname(p) for pat in pats for p in glob.glob(os.path.join(sp, pat))}); \
open('/etc/ld.so.conf.d/torch-cuda.conf', 'w').write('\n'.join(dirs) + '\n'); \
print('registered lib dirs:', dirs)" && \
    ldconfig && \
    BNB_SO=$(find /opt/conda/envs/tallrec -name libbitsandbytes_cuda118.so | head -1) && \
    echo "checking $BNB_SO" && ldd "$BNB_SO" && \
    if ldd "$BNB_SO" | grep -q "not found"; then echo "ERROR: unresolved libs for bitsandbytes"; exit 1; fi

WORKDIR /workspace
COPY app.py /workspace/app.py

# Model artifacts are loaded from the GCS bucket mounted at runtime.
# Cloud Run volume mounts cannot target "/", so keep artifacts at the BUCKET ROOT
# and mount the bucket at /models:
#   gs://llmeval_music/tallrec/llama-7b-hf  -> /models/tallrec/llama-7b-hf
#   gs://llmeval_music/tallrec/lora         -> /models/tallrec/lora
#   gs://llmeval_music/knn                  -> /models/knn
ENV TALLREC_BASE=/models/tallrec/llama-7b-hf \
    TALLREC_LORA=/models/tallrec/lora \
    KNN_DIR=/models/knn \
    AUDIO_LIST_TABLE=audio_list \
    TALLREC_LOAD_8BIT=1 \
    TALLREC_BATCH=8 \
    TALLREC_RERANK_POOL=100 \
    HF_HUB_OFFLINE=1

# Cloud Run Port
EXPOSE 8080

ENTRYPOINT ["micromamba","run","-n","tallrec","uvicorn","app:app","--host","0.0.0.0","--port","8080","--log-level","info"]
