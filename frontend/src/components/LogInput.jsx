import React, { useState } from 'react';
import styles from './LogInput.module.css';

export default function LogInput({ input, setInput, loadingAnalyze }) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    const allowed = ['.txt', '.log', '.json'];
    if (!allowed.some(ext => file.name.endsWith(ext))) {
      alert("Only .txt, .log, .json allowed!");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => setInput(ev.target.result);
    reader.readAsText(file);
  };

  return (
    <div
      className={`${styles.container} ${dragActive ? styles.dragActive : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      <label className={styles.label}>📋 Paste Logs or Drag & Drop:</label>

      <textarea
        className={styles.textarea}
        rows={15}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={loadingAnalyze}
        placeholder="Paste logs or drop .txt/.log files here..."
      />

      {dragActive && (
        <div className={styles.dragOverlay}>Drop file to load logs</div>
      )}
    </div>
  );
}
