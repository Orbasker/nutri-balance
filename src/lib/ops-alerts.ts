type JsonRecord = Record<string, unknown>;

function parseCsvValues(raw: string | undefined): string[] {
  if (!raw) return [];

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function formatDetails(details: JsonRecord): string[] {
  return Object.entries(details)
    .filter(([, value]) => value != null && value !== "")
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
}

export async function sendResendEmailAlert(input: {
  title: string;
  headerLines?: string[];
  details?: JsonRecord;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_EMAIL_FROM;
  const recipients = parseCsvValues(process.env.ALERT_EMAIL_TO);

  if (!apiKey || !from || recipients.length === 0) {
    return false;
  }

  const text = [
    input.title,
    ...(input.headerLines ?? []),
    ...formatDetails(input.details ?? {}),
  ].join("\n");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: input.title,
        text,
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}
