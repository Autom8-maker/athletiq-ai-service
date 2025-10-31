type Snapshot = {
  readiness: number;
  sleep: { durationHrs: number; efficiency: number; consistency: number };
  recovery: { score: number; hrvMs: number; restingHr: number };
  workload: { completed: number; goal: number };
};

export function buildCoachMessages(message: string, s: Snapshot) {
  const sys = `
You are AthletIQ Coach, an AI performance assistant.
Be concise, prescriptive, and athlete-friendly.
Use today's metrics and explain “why” in simple terms.
End with a short "Today's Plan" (≤3 bullets).`.trim();

  const ctx = `
Context
- Readiness: ${s.readiness}
- Recovery: score ${s.recovery.score}, HRV ${s.recovery.hrvMs} ms, Resting HR ${s.recovery.restingHr} bpm
- Sleep: ${s.sleep.durationHrs.toFixed(1)} h, Eff ${(s.sleep.efficiency*100).toFixed(0)}%, Consistency ${(s.sleep.consistency*100).toFixed(0)}%
- Workouts: ${s.workload.completed}/${s.workload.goal} this week`.trim();

  return [
    { role: "system", content: sys },
    { role: "user", content: `${ctx}\n\nQuestion: ${message}` },
  ] as const;
}
