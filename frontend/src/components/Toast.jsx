import React from "react";
import "./Toast.css";

export default function Toast({ msg, type }) {
  return (
    <div className={`toast ${type === "success" ? "toastSuccess" : "toastError"}`}>
      {msg}
    </div>
  );
}
