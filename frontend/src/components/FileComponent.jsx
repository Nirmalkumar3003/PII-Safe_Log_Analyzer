import React from "react";
import styles from "./FileUpload.module.css";

export default function FileUpload({ setInput }) {

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowed = ["text/plain", "application/json", "application/log"];
    if (!allowed.includes(file.type) && !file.name.endsWith(".log") && !file.name.endsWith(".txt")) {
      alert("Only .txt and .log files allowed");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setInput(ev.target.result);  // Inserts file text into textbox
    };
    reader.readAsText(file);
  };

  return (
    <div className={styles.uploadBox}>
      <label className={styles.label}>📂 Upload Log File</label>
      <input type="file" accept=".txt,.log,.json" onChange={handleFile} className={styles.fileInput} />
    </div>
  );
}
