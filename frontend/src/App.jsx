import React, { useState, useRef } from "react";

import LogInput from "./components/LogInput.jsx";
import AiReply from "./components/AiReply.jsx";
import Toast from "./components/Toast.jsx";

import "./App.module.css";

const API_BASE = "http://localhost:4000";

export default function App() {
  const [input, setInput] = useState("");
  const [analysis, setAnalysis] = useState(null); // { original, masked, entities, summary }
  const [loadingAnalyze, setLoadingAnalyze] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [reply, setReply] = useState("");
  const [toast, setToast] = useState(null);

  // Track errors already sent to AI (so they won't be shown/sent again)
  const [sentErrorSet, setSentErrorSet] = useState(() => new Set());

  const fileInputRef = useRef(null);

  // helper toast
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Extract lines containing error/exception (case-insensitive),
  // dedupe identical lines and filter out ones already sent.
  function extractErrorLinesDeduped(text) {
    if (!text) return [];

    // split into lines and normalize
    const lines = text.split(/\r?\n/);

    const errorLines = [];
    const seenLocal = new Set();

    for (let rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // consider a line an error if it contains "error" or "exception"
      if (/\b(error|exception)\b/i.test(line)) {
        // dedupe locally
        const key = line;
        if (!seenLocal.has(key) && !sentErrorSet.has(key)) {
          seenLocal.add(key);
          errorLines.push(key);
        }
      }
    }
    return errorLines;
  }

  // Called when the user clicks Analyze (analyze whole input but only extract errors to mask/send)
  const handleAnalyze = async () => {
    if (!input.trim()) {
      showToast("Paste logs or upload a file first", "error");
      return;
    }
    await processAndAnalyzeInput(input);
  };

  // Process input: extract error lines deduped, call /analyze on only the errors joined,
  // set analysis.masked to the masked errors, and do not include previously-sent errors.
  async function processAndAnalyzeInput(fullText) {
    setLoadingAnalyze(true);
    setAnalysis(null);
    setReply("");

    try {
      const errorLines = extractErrorLinesDeduped(fullText);

      if (errorLines.length === 0) {
        setAnalysis({
          original: fullText,
          masked: "",
          entities: [],
          summary: "No new error/exception lines found to send to AI."
        });
        showToast("No new error/exception lines found", "success");
        setLoadingAnalyze(false);
        return;
      }

      const errorPayload = errorLines.join("\n");

      // Send only the error lines to /analyze so backend masks PII there
      const res = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: errorPayload })
      });

      const data = await res.json();

      // data.masked contains masked version of the errorPayload
      // We will map each deduped error line to its masked placeholder lines for display.
      // For simplicity, display data.masked as the masked errors block.
      setAnalysis({
        original: fullText,
        masked: data.masked || "",
        entities: data.entities || [],
        summary: data.summary || `Prepared ${errorLines.length} error lines (masked).`
      });

      showToast(`Prepared ${errorLines.length} error line(s) to send`, "success");
    } catch (err) {
      console.error(err);
      showToast("Analyze failed", "error");
    } finally {
      setLoadingAnalyze(false);
    }
  }

  // File input handlers (file upload behaves same as pasting text)
  const handleFileChange = async (e) => {
    const f = e.target.files?.[0];
    if (f) await readFileAndProcess(f);
    // reset value so uploading same file again triggers change
    e.target.value = null;
  };

  const handleFileDrop = async (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (f) await readFileAndProcess(f);
  };

  async function readFileAndProcess(file) {
    if (!file) return;
    const allowed = [".txt", ".log", ".json"];
    const name = file.name.toLowerCase();
    if (!allowed.some((ext) => name.endsWith(ext))) {
      showToast("Only .txt / .log / .json files supported", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const content = ev.target.result;
      setInput(content);
      // Immediately process errors-only flow
      await processAndAnalyzeInput(content);
    };
    reader.onerror = () => {
      showToast("Failed to read file", "error");
    };
    reader.readAsText(file);
  }

  // Send masked errors to AI (only new ones). After sending, mark these error lines as sent.
  const handleSendToLlm = async () => {
    if (!analysis || !analysis.masked || !analysis.masked.trim()) {
      showToast("No masked errors to send", "error");
      return;
    }

    // Before sending, attempt to find the original error lines that correspond.
    // We have original: fullText; extract deduped lines again but only those used in last analysis.
    const errorLines = extractErrorLinesDeduped(analysis.original);

    if (errorLines.length === 0) {
      showToast("No new errors to send (they might have been already sent)", "error");
      return;
    }

    setLoadingChat(true);
    setReply("");

    try {
      // Send masked errors (analysis.masked) to /chat and stream response
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maskedMessage: analysis.masked })
      });

      if (!res.ok) {
        const err = await res.text();
        showToast("AI request failed", "error");
        console.error("AI error", err);
        setLoadingChat(false);
        return;
      }

      // read streaming body
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let aiText = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        aiText += decoder.decode(value);
        setReply(aiText);
      }

      // mark the errorLines as sent so they won't show/send again
      setSentErrorSet((prev) => {
        const copy = new Set(prev);
        for (const l of errorLines) copy.add(l);
        return copy;
      });

      showToast("AI analysis completed and errors marked as sent", "success");
    } catch (err) {
      console.error(err);
      showToast("AI streaming failed", "error");
    } finally {
      setLoadingChat(false);
    }
  };

  // Prevent default browser behavior for drag over
  const preventDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // UI-safe inline styles to avoid horizontal scroll and ensure white UI background per your request
  const pageStyles = {
    overflowX: "hidden",
    background: "#ffffff",
    color: "#000000",
    minHeight: "100vh",
    boxSizing: "border-box",
  };

  const rightPanelStyles = {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    flex: 1,
  };

  return (
    <div style={pageStyles} className="app-container" onDragOver={preventDrag} onDrop={preventDrag}>
      <header className="app-header">
        <h1>PII-Safe Log Analyzer</h1>
        <p>Upload logs or paste them — only new error/exception lines are masked and sent to the AI.</p>
      </header>

      <section className="input-section" style={{ alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <LogInput input={input} setInput={setInput} loadingAnalyze={loadingAnalyze} />

          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button
              onClick={handleAnalyze}
              disabled={loadingAnalyze || !input.trim()}
              className="analyze-button"
            >
              {loadingAnalyze ? "Preparing..." : "Prepare Errors (Analyze)"}
            </button>

            <label
              style={{
                display: "inline-block",
                padding: "14px 20px",
                background: "#f3f4f6",
                borderRadius: 8,
                cursor: "pointer",
                border: "1px solid #e5e7eb",
                fontWeight: 600,
              }}
            >
              Upload file
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.log,.json"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
            </label>

            <div
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={handleFileDrop}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "14px 20px",
                border: "1px dashed #d1d5db",
                borderRadius: 8,
                cursor: "copy",
                userSelect: "none",
              }}
            >
              Drag & Drop File Here
            </div>
          </div>
        </div>

        {/* Right column: masked errors + AI reply */}
        <div style={rightPanelStyles}>
          <div className="container" style={{ padding: 16 }}>
            <h2 style={{ marginBottom: 8 }}>Masked Errors (sent to AI)</h2>
            <div
              className="masked-logs"
              style={{
                background: "#000",
                color: "#fff",
                padding: 12,
                borderRadius: 8,
                minHeight: 160,
                whiteSpace: "pre-wrap",
                fontFamily: "Monaco, Consolas, monospace",
                fontSize: 13,
                overflowY: "auto",
                border: "1px solid #333",
              }}
            >
              {analysis && analysis.masked ? (
                <div dangerouslySetInnerHTML={{ __html: escapeHtmlNewlines(analysis.masked) }} />
              ) : (
                <div style={{ color: "#9ca3af" }}>No masked errors prepared yet.</div>
              )}
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button
                onClick={handleSendToLlm}
                disabled={loadingChat || !analysis || !analysis.masked}
                className="analyze-button"
                style={{ background: "#10b981" }}
              >
                {loadingChat ? "Sending to AI..." : "Send Errors to AI"}
              </button>

              <button
                onClick={() => {
                  // download masked errors as file
                  if (!analysis || !analysis.masked) {
                    showToast("No masked errors to download", "error");
                    return;
                  }
                  const blob = new Blob([analysis.masked], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `masked_errors_${Date.now()}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                style={{
                  padding: "12px 18px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                ⬇ Download Masked Errors
              </button>
            </div>
          </div>

          <div style={{ borderRadius: 8, padding: 16 }}>
            <AiReply reply={reply} />
          </div>
        </div>
      </section>

      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* Inline style fallback to ensure AI reply text is black */}
      <style>{`
        .ai-reply-text { color: #000 !important; }
        /* Ensure no horizontal overflow on very small screens */
        html, body, #root { overflow-x: hidden; }
      `}</style>
    </div>
  );
}

// small helper to show newlines in masked content safely
function escapeHtmlNewlines(s) {
  if (!s) return "";
  const esc = s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return esc.replace(/\r?\n/g, "<br/>");
}
