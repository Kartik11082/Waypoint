# Waypoint — Switchable AI provider (Bedrock or OpenRouter)
# Set AI_PROVIDER=bedrock or AI_PROVIDER=openrouter in .env
# Both providers expose the same call_llm(prompt, system, max_tokens) interface.
import json
import os

import httpx

_bedrock_client = None


def get_provider():
    """Return the configured AI provider name."""
    return os.getenv("AI_PROVIDER", "bedrock").lower()


# ── Bedrock (AWS Claude) ────────────────────────────────


def _get_bedrock_client():
    global _bedrock_client
    if _bedrock_client is None:
        import boto3
        _bedrock_client = boto3.client(
            "bedrock-runtime",
            region_name=os.getenv("AWS_REGION", "us-east-1"),
        )
    return _bedrock_client


def _call_bedrock(prompt, system, max_tokens):
    model_id = os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-3-haiku-20240307-v1:0")
    client = _get_bedrock_client()

    resp = client.invoke_model(
        modelId=model_id,
        body=json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "system": system,
            "messages": [{"role": "user", "content": prompt}],
        }),
    )

    return json.loads(resp["body"].read())["content"][0]["text"].strip()


# ── OpenRouter ──────────────────────────────────────────


def _call_openrouter(prompt, system, max_tokens):
    api_key = os.getenv("OPENROUTER_API_KEY", "")
    model = os.getenv("OPENROUTER_MODEL", "openrouter/hunter-alpha")

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    resp = httpx.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"].strip()


# ── Unified interface ───────────────────────────────────


def call_llm(prompt, system, max_tokens=200):
    """Send a prompt to the configured AI provider and return raw text.

    Supports: bedrock, openrouter
    Set AI_PROVIDER in .env to switch.
    """
    provider = get_provider()

    if provider == "openrouter":
        raw_text = _call_openrouter(prompt, system, max_tokens)
    else:
        raw_text = _call_bedrock(prompt, system, max_tokens)

    # Strip markdown code fences if the model wraps JSON
    if raw_text.startswith("```"):
        raw_text = raw_text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

    return raw_text
