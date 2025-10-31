import type { NextApiRequest, NextApiResponse } from "next";
import { buildCoachMessages } from "../../lib/prompt";
import OpenAI from "openai";

// Later: replace with Firebase verifyIdToken once dashboard login is wired
// import { verifyIdToken } from "../../lib/firebase";

async function getTenantConfig(uid: string) {
  return {
    plan: "starter",
    provider: "openai" as const,
    model: "gpt-4o-mini",
    apiKey: process.env.OPENAI_API_KEY!,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    // const decoded = await verifyIdToken(req.headers.authorization);
    const decoded = { uid: "dev" }; // temporary for local testing

    const { message, dataSnapshot } = req.body || {};
    if (!message || !dataSnapshot) {
      return res.status(400).json({ error: "Missing message or dataSnapshot" });
    }

    const tenant = await getTenantConfig(decoded.uid);
    const client = new OpenAI({ apiKey: tenant.apiKey });
    const messages = buildCoachMessages(message, dataSnapshot);

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    const stream = await client.chat.completions.create({
      model: tenant.model,
      messages: messages as any,
      temperature: 0.4,
      stream: true,
    });

    for await (const chunk of stream) {
      const token = chunk.choices?.[0]?.delta?.content;
      if (token) res.write(token);
    }

    res.end();
  } catch (err: any) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else res.end();
  }
}

export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };
