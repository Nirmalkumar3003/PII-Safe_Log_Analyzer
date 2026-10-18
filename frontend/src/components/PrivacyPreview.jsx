import React from "react";
import styles from "./PrivacyPreview.module.css";

export default function PrivacyPreview({
  analysis,
  handleSendToLlm,
  loadingChat,
}) {
  const highlightEntities = () => {
    const { original, entities } = analysis;
    if (!entities || entities.length === 0) return <span>{original}</span>;

    const sorted = [...entities].sort((a, b) => a.start - b.start);
    const parts = [];
    let last = 0;

    sorted.forEach((e, i) => {
      if (e.start > last) {
        parts.push(
          <span key={`txt-${i}`}>{original.slice(last, e.start)}</span>
        );
      }
      parts.push(
        <span
          key={`pii-${i}`}
          className={styles.piiHighlight}
          title={`${e.type} (${e.context})`}
        >
          {original.slice(e.start, e.end)}
        </span>
      );
      last = e.end;
    });

    if (last < original.length) {
      parts.push(
        <span key="tail">{original.slice(last)}</span>
      );
    }

    return parts;
  };

  const downloadMasked = () => {
    const blob = new Blob([analysis.masked], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `masked_logs_${Date.now()}.txt`;
    link.click();
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>🔒 Privacy Preview</h2>

      <div className={styles.previewGrid}>

        <div className={styles.logSection}>
          <div className={`${styles.sectionHeader} ${styles.sectionHeaderDanger}`}>
            🚨 ORIGINAL Logs (Contains PII)
          </div>
          <div className={styles.originalLogs}>
            <div className={`${styles.badge} ${styles.badgeDanger}`}>PII FOUND</div>
            {highlightEntities()}
          </div>
        </div>

        <div className={styles.logSection}>
          <div className={`${styles.sectionHeader} ${styles.sectionHeaderSafe}`}>
            ✅ Masked Logs (Safe for AI)
          </div>
          <div className={styles.maskedLogs}>
            <div className={`${styles.badge} ${styles.badgeSafe}`}>
              PII SAFE ✓
            </div>

            {analysis.masked.split(/(\[[A-Z_0-9]+\])/).map((part, i) =>
              part.startsWith("[") ? (
                <span key={i} className={styles.maskedToken}>{part}</span>
              ) : (
                part
              )
            )}
          </div>
        </div>

      </div>

      <div className={styles.actionSection}>
        <p className={styles.summary}>{analysis.summary}</p>

        <button
          onClick={downloadMasked}
          className={styles.sendButton}
        >
          ⬇️ Download Masked Logs
        </button>

        <button
          onClick={handleSendToLlm}
          disabled={loadingChat}
          className={`${styles.sendButton} ${loadingChat ? styles.sendButtonDisabled : ""}`}
        >
          {loadingChat ? "💭 AI is analyzing..." : "🤖 Send to AI"}
        </button>
      </div>
    </div>
  );
}
