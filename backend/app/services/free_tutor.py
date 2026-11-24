"""General (resource-free) tutor. Same Socratic / Direct styles, answers from the model's own knowledge."""
from ..db import insert, many, update, utcnow
from ..serializers import free_chat_dict, free_message_dict
from ..utils import log_activity
from . import llm
from .tutor import ACTION_TEXT, DIRECT, LEVEL, SOCRATIC, is_invalid_keypress

BASE = """You are Socrates, the AI tutor of Learn with Socrates, an expert, patient tutor who can teach ANY subject from your own knowledge.
The student has NOT uploaded study material for this chat, so teach from general knowledge.

RULES
- Be accurate. If you are unsure, say so. Never invent sources, citations, page numbers or quotations.
- In Socratic mode keep replies short (about 40-120 words) and end with one question.
- If the student's first message is a topic or question, start teaching it right away.
- Use light Markdown only (short lists, **bold** for key terms).
- For mathematical expressions, scientific laws, or derivations: ALWAYS format formulas using LaTeX notation: use $$...$$ on its own line for standalone equations (e.g. $$ \mathbf{F}_{\text{net}} = \frac{d\mathbf{p}}{dt} $$), and $...$ for inline variables and equations (e.g. $m$, $\mathbf{v}$, $F = ma$). Never use bare brackets like [...] or (...) for math.
- INVALID KEYPRESS / GIBBERISH: If the student's message contains accidental keypresses, keyboard mashing, or nonsensical gibberish (e.g. 'g88yg88', 'asdfgh', '123qweasd'): NEVER treat it as an attempt to answer the academic question, and NEVER record a misconception. Politely inform them that an invalid keypress was detected and ask them to type their response or question correctly."""

OUTPUT = """OUTPUT FORMAT: return ONLY a JSON object:
{"reply": "<your reply>", "misconception": null or "<short description of a misconception in the student's latest message>"}"""

LANGUAGE_MAP = {
    "ta-IN": "Tamil (தமிழ்)",
    "ta": "Tamil (தமிழ்)",
    "tamil": "Tamil (தமிழ்)",
    "hi-IN": "Hindi (हिन्दी)",
    "hi": "Hindi (हिन्दी)",
    "hindi": "Hindi (हिन्दी)",
    "te-IN": "Telugu (తెలుగు)",
    "te": "Telugu (తెలుగు)",
    "telugu": "Telugu (తెలుగు)",
    "kn-IN": "Kannada (ಕನ್ನಡ)",
    "kn": "Kannada (ಕನ್ನಡ)",
    "kannada": "Kannada (ಕನ್ನಡ)",
    "ml-IN": "Malayalam (മലയാളം)",
    "ml": "Malayalam (മലയാളം)",
    "malayalam": "Malayalam (മലയാളം)",
    "es-ES": "Spanish (Español)",
    "es": "Spanish (Español)",
    "spanish": "Spanish (Español)",
    "fr-FR": "French (Français)",
    "fr": "French (Français)",
    "french": "French (Français)",
    "de-DE": "German (Deutsch)",
    "de": "German (Deutsch)",
    "german": "German (Deutsch)",
    "en-US": "English",
    "en-IN": "English",
    "en-GB": "English",
    "en": "English",
    "english": "English",
}


def resolve_language(lang_code):
    if not lang_code:
        return "English"
    key = str(lang_code).strip().lower()
    for k, v in LANGUAGE_MAP.items():
        if key == k.lower():
            return v
    return str(lang_code).strip()


def respond(chat, text, action=None, language=None):
    target_lang_code = language or chat.get("language") or "en-US"
    target_lang_name = resolve_language(target_lang_code)

    student_text = ACTION_TEXT.get(action) if action else text

    # Intercept invalid keypresses / keyboard mashing immediately
    if not action and is_invalid_keypress(student_text):
        if "tamil" in target_lang_name.lower():
            reply = f"தவறான விசை அழுத்தம் (**`{student_text}`**) கண்டறியப்பட்டது. நாம் தொடர்ந்து கற்க உங்கள் பதிலை அல்லது கேள்வியை சரியாக உள்ளிடவும்!"
        elif "hindi" in target_lang_name.lower():
            reply = f"ऐसा लगता है कि गलत की-प्रेस या टाइपो (**`{student_text}`**) दर्ज हुआ है। कृपया अपना उत्तर या प्रश्न सही ढंग से टाइप करें ताकि हम जारी रख सकें!"
        else:
            reply = (
                f"It looks like an invalid keypress or typo (**`{student_text}`**). "
                f"Please type your response or question correctly so we can continue!"
            )
        um = insert("free_messages", {
            "chat_id": chat["_id"],
            "role": "user",
            "content": student_text,
            "action": action,
            "language": target_lang_code
        })
        am = insert("free_messages", {
            "chat_id": chat["_id"],
            "role": "assistant",
            "content": reply,
            "action": None,
            "language": target_lang_code
        })
        update("free_chats", chat["_id"], {"last_active_at": utcnow()})
        return {
            "user_message": free_message_dict(um),
            "assistant_message": free_message_dict(am),
            "chat": free_chat_dict(chat)
        }

    if action == "start":
        if "tamil" in target_lang_name.lower():
            student_text = "வணக்கம், நான் என்ன கற்றுக்கொள்ள விரும்புகிறேன் என்று கேட்டுத் தொடங்குங்கள்."
        elif "hindi" in target_lang_name.lower():
            student_text = "नमस्ते, मुझसे पूछकर शुरुआत करें कि मैं क्या सीखना चाहता हूँ।"
        else:
            student_text = "Please start by asking me what I want to learn."

    recent = many("free_messages", {"chat_id": chat["_id"]}, sort=[("_id", -1)], limit=12)[::-1]
    contents = [{"role": "user" if m["role"] == "user" else "model", "text": m["content"][:3000]} for m in recent]
    while contents and contents[0]["role"] != "user":
        contents.pop(0)
    contents.append({"role": "user", "text": student_text})

    mis = chat.get("misconceptions") or []
    ctx = (
        "STUDENT CONTEXT\n"
        f"- Student ID: {chat['user_id']}\n- Teaching mode: {chat['mode_code']}\n- Student level: {chat['difficulty']}\n"
        f"- Target language: {target_lang_name}\n"
        f"- Known misconceptions to address: {'; '.join(mis[-5:]) if mis else 'none yet'}"
    )

    lang_req = ""
    if "english" not in target_lang_name.lower():
        lang_req = (
            f"CRITICAL LANGUAGE REQUIREMENT:\n"
            f"- The user's selected language is {target_lang_name}.\n"
            f"- You MUST write your ENTIRE reply (explanations, questions, analogies, and greetings) in {target_lang_name} using its native script.\n"
            f"- Even if the user asks in English or another language (for example 'teach energy'), explain and teach completely in {target_lang_name}.\n"
            f"- Keep mathematical formulas, symbols, and units (e.g. $E = mc^2$, $F = ma$, \\frac{{dp}}{{dt}}, kg, m/s) in standard mathematical notation."
        )

    parts = [BASE, SOCRATIC if chat["mode_code"] == "socratic" else DIRECT,
             LEVEL.get(chat["difficulty"], LEVEL["beginner"])]
    if lang_req:
        parts.append(lang_req)
    parts.extend([ctx, OUTPUT])
    system = "\n\n".join(parts)

    raw = llm.generate(system, contents, json_mode=True, temperature=0.6, max_tokens=2000)
    data = llm.parse_json(raw)
    reply = (str(data.get("reply")) if isinstance(data, dict) and data.get("reply") else raw).strip()
    data = data if isinstance(data, dict) else {}

    um = insert("free_messages", {"chat_id": chat["_id"], "role": "user", "content": student_text, "mode_code": chat["mode_code"]})
    am = insert("free_messages", {"chat_id": chat["_id"], "role": "assistant", "content": reply, "mode_code": chat["mode_code"]})

    fields = {"last_active_at": utcnow()}
    m = data.get("misconception")
    if isinstance(m, str) and m.strip():
        lst = list(chat.get("misconceptions") or [])
        if m.strip() not in lst:
            lst.append(m.strip()[:200])
        fields["misconceptions"] = lst[-10:]
    if chat.get("title") == "New chat" and not action and text:
        fields["title"] = text[:60]
    update("free_chats", chat["_id"], fields)
    chat.update(fields)
    log_activity(chat["user_id"], "free_chat", None, None, chat["mode_code"], 0)
    return {"user_message": free_message_dict(um), "assistant_message": free_message_dict(am), "chat": free_chat_dict(chat)}
