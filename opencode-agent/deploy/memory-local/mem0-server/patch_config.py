"""
Patch mem0 server/main.py 的 DEFAULT_CONFIG，注入 DeepSeek（LLM）+ 通义（embedder）配置。

原 DEFAULT_CONFIG 的 llm/embedder config 只有 {api_key, temperature, model}，
默认走 OpenAI 官方 endpoint，国内环境不可用。

本脚本补 openai_base_url + 改 model 名，并让 llm/embedder 用不同的环境变量
（DEEPSEEK_API_KEY / TONGYI_API_KEY），避免共用 OPENAI_API_KEY。

用法：python patch_config.py main.py
（在 Dockerfile builder 阶段执行）
"""
import re
import sys
from pathlib import Path


def patch(content: str) -> str:
    # ── 1. 替换 llm 段：补 openai_base_url（DeepSeek）+ 改 api_key 来源 + 改默认 model ──
    old_llm = '''    "llm": {
        "provider": "openai",
        "config": {"api_key": OPENAI_API_KEY, "temperature": 0.2, "model": DEFAULT_LLM_MODEL},
    },'''
    new_llm = '''    "llm": {
        "provider": "openai",
        "config": {
            "api_key": os.environ.get("DEEPSEEK_API_KEY") or OPENAI_API_KEY,
            "temperature": 0.2,
            "model": os.environ.get("MEM0_DEFAULT_LLM_MODEL", "deepseek-chat"),
            "openai_base_url": os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1"),
        },
    },'''
    if old_llm not in content:
        raise SystemExit("[patch] 找不到 llm 配置段，main.py 结构可能已变，请检查")
    content = content.replace(old_llm, new_llm)

    # ── 2. 替换 embedder 段：补 openai_base_url（通义）+ 改 api_key 来源 + 改默认 model ──
    old_embedder = '''    "embedder": {"provider": "openai", "config": {"api_key": OPENAI_API_KEY, "model": DEFAULT_EMBEDDER_MODEL}},'''
    new_embedder = '''    "embedder": {
        "provider": "openai",
        "config": {
            "api_key": os.environ.get("TONGYI_API_KEY") or OPENAI_API_KEY,
            "model": os.environ.get("MEM0_DEFAULT_EMBEDDER_MODEL", "text-embedding-v3"),
            "openai_base_url": os.environ.get("TONGYI_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
            "embedding_dims": 1024,
        },
    },'''
    if old_embedder not in content:
        raise SystemExit("[patch] 找不到 embedder 配置段，main.py 结构可能已变，请检查")
    content = content.replace(old_embedder, new_embedder)

    return content


def main():
    if len(sys.argv) != 2:
        raise SystemExit("用法: python patch_config.py <main.py 路径>")
    path = Path(sys.argv[1])
    content = path.read_text(encoding="utf-8")
    patched = patch(content)
    path.write_text(patched, encoding="utf-8")
    print(f"[patch] 已修改 {path}")


if __name__ == "__main__":
    main()
