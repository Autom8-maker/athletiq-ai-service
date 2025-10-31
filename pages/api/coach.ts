// pages/api/coach.ts
import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { buildCoachMessages } from "../../lib/prompt";

// ---- Types ----
export type Snapshot = {
  readiness: number;
  sleep: { durationHrs: number; efficiency: number; consistency: number };
  recovery: { score: number; hrvMs: number; restingHr: number };
  workload: { completed: number; goal: number };
};

type CoachReq = {
  message: string;
  dataSnapshot: Snapshot;
};

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

// ---- CORS helper ----
function setCors(res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*"); // tighten to your dashboard origin if you want
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setCors(res);

  // Preflight
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    // const decoded = await verifyIdToken(req.headers.authorization);
    const decoded = { uid: "dev" }; // temporary for local/testing

    // Parse & validate body
    const { message, dataSnapshot } = (req.body || {}) as Partial<CoachReq>;

    if (!message || !dataSnapshot) {
      res.status(400).json({ error: "Missing message or dataSnapshot" });
      return;
    }

    // Light runtime guard (keeps TS happy and avoids bad calls)
    const ok =
      typeof dataSnapshot.readiness === "number" &&
      dataSnapshot.sleep &&
      typeof dataSnapshot.sleep.durationHrs === "number" &&
      dataSnapshot.recovery &&
      typeof dataSnapshot.recovery.score === "number" &&
      dataSnapshot.workload &&
      typeof dataSnapshot.workload.completed === "number";

    if (!ok) {
      res.status(400).json({ error: "Invalid dataSnapshot shape" });
      return;
    }

    const tenant = await getTenantConfig(decoded.uid);
    if (!tenant.apiKey) {
      res.status(500).json({ error: "Missing OPENAI_API_KEY" });
      return;
    }

    const client = new OpenAI({ apiKey: tenant.apiKey });

    // ✅ Strongly-typed snapshot for buildCoachMessages
    const messages = buildCoachMessages(message, dataSnapshot as Snapshot);

    // Streaming headers (include CORS)
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message || "Server error" });
    } else {
      try { res.end(); } catch {}
    }
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
};
