import { useCallback, useEffect, useRef, useState } from "react";

const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const synth = typeof window !== "undefined" ? window.speechSynthesis : null;

/** Remove Markdown so the voice does not read symbols aloud. */
export function cleanForSpeech(md) {
  return md
    .replace(/```[\s\S]*?```/g, " (code example shown on screen) ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\\\[([\s\S]*?)\\\]/g, " $1 ")
    .replace(/\\\(([\s\S]*?)\\\)/g, " $1 ")
    .replace(/\$\$([\s\S]*?)\$\$/g, " $1 ")
    .replace(/\$([^\$]+)\$/g, " $1 ")
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 over $2")
    .replace(/\\mathbf\{([^}]+)\}/g, "$1")
    .replace(/\\text\{([^}]+)\}/g, "$1")
    .replace(/\\times/g, " times ")
    .replace(/\\Delta/g, " delta ")
    .replace(/\\equiv/g, " equals ")
    .replace(/\\,/g, " ")
    .replace(/\\/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\[S\d+\]/g, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[#*_>|~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(text, max = 180) {
  const parts = text.match(/[^.!?।]+[.!?।]*\s*/g) || [text];
  const out = [];
  let cur = "";
  for (const p of parts) {
    if ((cur + p).length > max && cur) { out.push(cur.trim()); cur = ""; }
    cur += p;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export default function useSpeech(lang = "en-US", rate = 1) {
  const [voices, setVoices] = useState([]);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const recRef = useRef(null);

  useEffect(() => {
    if (!synth) return;
    const load = () => setVoices(synth.getVoices());
    load();
    synth.addEventListener("voiceschanged", load);
    return () => {
      synth.removeEventListener("voiceschanged", load);
      synth.cancel();
      recRef.current?.abort?.();
    };
  }, []);

  const stopSpeaking = useCallback(() => {
    synth?.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (markdown) => {
      if (!synth) return;
      const text = cleanForSpeech(markdown);
      if (!text) return;
      synth.cancel();
      const base = lang.split("-")[0];
      const voice = voices.find((v) => v.lang === lang) || voices.find((v) => v.lang.startsWith(base));
      const chunks = splitSentences(text);
      setSpeaking(true);
      chunks.forEach((chunk, i) => {
        const u = new SpeechSynthesisUtterance(chunk);
        u.lang = lang;
        u.rate = rate;
        if (voice) u.voice = voice;
        if (i === chunks.length - 1) {
          u.onend = () => setSpeaking(false);
        }
        u.onerror = () => setSpeaking(false);
        synth.speak(u);
      });
    },
    [lang, rate, voices]
  );

  const stopListening = useCallback(() => {
    recRef.current?.stop?.();
    setListening(false);
  }, []);

  /** onText(text, isFinal, errorCode). Returns false when the browser has no speech recognition. */
  const listen = useCallback(
    (onText) => {
      if (!SR) return false;
      stopSpeaking();
      const rec = new SR();
      rec.lang = lang;
      rec.interimResults = true;
      rec.continuous = false;
      rec.onresult = (e) => {
        let text = "";
        let final = false;
        for (let i = 0; i < e.results.length; i++) {
          text += e.results[i][0].transcript;
          if (e.results[i].isFinal) final = true;
        }
        onText(text, final);
      };
      rec.onerror = (e) => {
        setListening(false);
        onText("", false, e.error);
      };
      rec.onend = () => setListening(false);
      recRef.current = rec;
      setListening(true);
      try {
        rec.start();
      } catch {
        setListening(false);
      }
      return true;
    },
    [lang, stopSpeaking]
  );

  return {
    supportsSTT: !!SR,
    supportsTTS: !!synth,
    voices,
    listening,
    speaking,
    speak,
    stopSpeaking,
    listen,
    stopListening,
  };
}
