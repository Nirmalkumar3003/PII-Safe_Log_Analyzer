import React from "react";
import styles from "./AiReply.module.css";

export default function AiReply({ reply }) {
  if (!reply) return null;

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>🤖 AI Log Analysis</h2>

      <div className={styles.replyBox}>
        {reply}
      </div>
    </div>
  );
}
