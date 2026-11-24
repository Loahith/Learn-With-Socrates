"""Groq chat-completions client (OpenAI-compatible REST). The API key stays on the server."""
import json
import re
import time

import requests
from flask import current_app

URL = "https://api.groq.com/openai/v1/chat/completions"


class LLMError(Exception):
    pass


class LLMNotConfigured(LLMError):
    pass


def available():
    return bool(current_app.config.get("GROQ_API_KEY"))


def _post(body, timeout=90):
    key = current_app.config.get("GROQ_API_KEY")
    if not key:
        raise LLMNotConfigured("AI is not configured. Add GROQ_API_KEY to backend/.env and restart.")
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    last = None
    for attempt in range(3):
        try:
            r = requests.post(URL, headers=headers, json=body, timeout=timeout)
        except requests.RequestException as exc:
            last = f"Network error: {exc}"
            time.sleep(1.5 * (attempt + 1))
            continue
        if r.status_code == 200:
            return r.json()
        if r.status_code in (429, 500, 502, 503):  # rate limit / temporary
            try:
                wait = float(r.headers.get("retry-after", 2 * (attempt + 1)))
            except ValueError:
                wait = 2 * (attempt + 1)
            last = "The AI service is busy or you hit the Groq rate limit. Wait a few seconds and try again."
            if attempt < 2:
                time.sleep(min(wait, 8))
            continue
        try:
            detail = r.json().get("error", {}).get("message", r.text[:200])
        except Exception:
            detail = r.text[:200]
        err = LLMError(f"AI request failed ({r.status_code}): {detail}")
        err.status = r.status_code
        err.detail = detail
        raise err
    raise LLMError(last or "AI request failed.")


def generate(system, contents, json_mode=False, temperature=0.4, max_tokens=2048):
    """contents: list of {"role": "user"|"model", "text": str}"""
    messages = [{"role": "system", "content": system}]
    for c in contents:
        messages.append({"role": "assistant" if c["role"] == "model" else "user", "content": c["text"]})
    body = {
        "model": current_app.config["GROQ_MODEL"],
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    try:
        data = _post(body)
    except LLMError as exc:
        # Groq rejects the reply if it is not valid JSON; retry once without strict JSON mode
        if json_mode and getattr(exc, "status", None) == 400 and "json" in getattr(exc, "detail", "").lower():
            body.pop("response_format")
            data = _post(body)
        else:
            raise
    try:
        return (data["choices"][0]["message"]["content"] or "").strip()
    except (KeyError, IndexError):
        raise LLMError("The AI returned an empty response. Try rephrasing.")


def parse_json(text):
    """Parse JSON from model output, tolerating code fences / extra text."""
    if not text:
        return None
    t = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    try:
        return json.loads(t)
    except Exception:
        pass
    m = re.search(r"\{.*\}", t, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            return None
    return None
