import { Ollama } from "ollama";

const ollama = new Ollama({ host: "http://127.0.0.1:11434" });

export function detectAndMaskPii(text) {
  const entities = [];
  let match;

  // Helper push function that handles capture groups properly
  function push(type, match, groupIndex = 0) {
    const extracted = match[groupIndex];
    const start = match.index + match[0].indexOf(extracted);
    const end = start + extracted.length;
    entities.push({ type, text: extracted, start, end });
  }

  // ----------------------------------------------------------------------
  // 🔥 GENERAL PII
  // ----------------------------------------------------------------------

  // EMAIL
  const email = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  while ((match = email.exec(text)) !== null) push("EMAIL", match);

  // IP ADDRESS (IPv4)
  const ip = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
  while ((match = ip.exec(text)) !== null) push("IP", match);

  // PHONE NUMBER
  const phone = /\+?\d{1,3}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,4}/g;
  while ((match = phone.exec(text)) !== null) push("PHONE", match);

  // SSN
  const ssn = /\b\d{3}-\d{2}-\d{4}\b/g;
  while ((match = ssn.exec(text)) !== null) push("SSN", match);

  // USERNAME (JSON)
  const usernameJson = /"username"\s*:\s*"([^"]+)"/gi;
  while ((match = usernameJson.exec(text)) !== null) push("USERNAME", match, 1);

  // USERNAME inline
  const usernameInline = /\buser(name)?=([A-Za-z0-9._-]+)/gi;
  while ((match = usernameInline.exec(text)) !== null) push("USERNAME", match, 2);

  // FIRST/LAST/FULL NAME
  const nameFields = /"(firstName|lastName|fullName|cardholderName)"\s*:\s*"([^"]+)"/gi;
  while ((match = nameFields.exec(text)) !== null) push("NAME", match, 2);

  // PASSWORD (JSON)
  const passwordJson = /"password"\s*:\s*"([^"]+)"/gi;
  while ((match = passwordJson.exec(text)) !== null) push("PASSWORD", match, 1);

  // PASSWORD inline
  const passwordInline = /(password|pass|pwd)[:=]\s*['"]?([^\s'"]{4,})/gi;
  while ((match = passwordInline.exec(text)) !== null) push("PASSWORD", match, 2);

  // DATE OF BIRTH
  const dob = /"(dateOfBirth|dob)"\s*:\s*"(\d{4}-\d{2}-\d{2})"/gi;
  while ((match = dob.exec(text)) !== null) push("DOB", match, 2);

  // ZIP CODE
  const zip = /"zip(Code)?"\s*:\s*"(\d{5})"/gi;
  while ((match = zip.exec(text)) !== null) push("ZIP", match, 2);

  // ----------------------------------------------------------------------
  // 🔥 ADDRESSES
  // ----------------------------------------------------------------------

  const street = /"street"\s*:\s*"([^"]+)"/gi;
  while ((match = street.exec(text)) !== null) push("ADDRESS", match, 1);

  const addressFull = /\b\d{1,5}\s+[A-Za-z0-9 .'-]+(?:Street|St|Avenue|Ave|Rd|Road|Lane|Ln|Drive|Dr)\b/g;
  while ((match = addressFull.exec(text)) !== null) push("ADDRESS", match);

  // ----------------------------------------------------------------------
  // 🔥 CREDIT CARD PII
  // ----------------------------------------------------------------------

  // CREDIT CARD NUMBER
  const cc = /\b(?:\d{4}[- ]?){3}\d{4}\b/g;
  while ((match = cc.exec(text)) !== null) push("CREDIT_CARD", match);

  // CVV
  const cvv = /"cvv"\s*:\s*"(\d{3,4})"/gi;
  while ((match = cvv.exec(text)) !== null) push("CVV", match, 1);

  // EXPIRY
  const expiry = /"(expiryMonth|expiryYear)"\s*:\s*"(\d{2,4})"/gi;
  while ((match = expiry.exec(text)) !== null) push("CARD_EXPIRY", match, 2);

  // ----------------------------------------------------------------------
  // 🔥 TOKENS (JWT, OAuth, API Keys)
  // ----------------------------------------------------------------------

  // JWT TOKEN
  const jwt =
    /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g;
  while ((match = jwt.exec(text)) !== null) push("JWT", match);

  // BEARER TOKEN
  const bearer = /Bearer\s+[A-Za-z0-9._-]{15,}/g;
  while ((match = bearer.exec(text)) !== null) push("BEARER_TOKEN", match);

  // ACCESS TOKEN
  const accessToken = /"(accessToken|refreshToken)"\s*:\s*"([^"]+)"/gi;
  while ((match = accessToken.exec(text)) !== null) push("ACCESS_TOKEN", match, 2);

  // API KEYS
  const apiKey = /\b(api[_-]?key|Authorization)\s*[:=]\s*["']?([A-Za-z0-9._-]{12,})/gi;
  while ((match = apiKey.exec(text)) !== null) push("API_KEY", match, 2);

  // OAUTH Client ID
  const oauthClient = /"clientId"\s*:\s*"([^"]+)"/gi;
  while ((match = oauthClient.exec(text)) !== null) push("CLIENT_ID", match, 1);

  // ----------------------------------------------------------------------
  // 🔥 SESSION / INTERNAL IDs
  // ----------------------------------------------------------------------

  const session = /\b(sess[_-][A-Za-z0-9]+|JSESSIONID[_A-Za-z0-9-]+)/g;
  while ((match = session.exec(text)) !== null) push("SESSION_ID", match);

  const internalIds = /\b(EMP|USER|CUST|ORD|TXN|msg|auth|id)[-_][A-Za-z0-9]+/gi;
  while ((match = internalIds.exec(text)) !== null) push("INTERNAL_ID", match);

  // ----------------------------------------------------------------------
  // 🔥 DATABASE / SMTP / REDIS / BACKUP PASSWORDS
  // ----------------------------------------------------------------------

  const highRiskPasswords =
    /\b(redis|smtp|mail|backup|cluster|db|database)[-_ ]?(password|pwd|pass)[:=]\s*["']?([A-Za-z0-9@!$%^&*()_+.-]{4,})/gi;
  while ((match = highRiskPasswords.exec(text)) !== null) push("PASSWORD", match, 3);

  const encryptionKey =
    /\bbackup[_-]?key[_A-Za-z0-9]*[:=]\s*["']?([A-Za-z0-9._-]{16,})/gi;
  while ((match = encryptionKey.exec(text)) !== null) push("ENCRYPTION_KEY", match, 1);

  // ----------------------------------------------------------------------
  // MASK TEXT
  // ----------------------------------------------------------------------

  const masked = maskText(text, entities);

  return {
    original: text,
    masked,
    entities,
    summary:
      entities.length === 0
        ? "No personal information detected."
        : `Found ${entities.length} PII items`,
  };
}

// Replace PII values with placeholder
function maskText(text, entities) {
  let masked = text;
  const sorted = [...entities].sort((a, b) => b.start - a.start);

  sorted.forEach((e, i) => {
    const token = `[${e.type}_${i + 1}]`;
    masked = masked.slice(0, e.start) + token + masked.slice(e.end);
  });

  return masked;
}

// ----------------------------
// STREAMING LLM
// ----------------------------
export async function analyzeWithLLM(maskedMessage) {
  return await ollama.chat({
    model: "llama3.1",
    stream: true,
    messages: [
      {
        role: "system",
        content:
          "You are a log analysis assistant. Sensitive data is already masked. Provide insights only on masked logs.",
      },
      { role: "user", content: maskedMessage },
    ],
  });
}
