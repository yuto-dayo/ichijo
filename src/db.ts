import Dexie, { type EntityTable } from "dexie";

export type Confidence = "hi" | "md" | "lo";

export interface SrsBoxEntity {
  id: string;
  box: number;
  updatedAt: number;
}

export interface SessionLogEntity {
  id?: number;
  sessionStamp: string;
  questionId: string | number;
  baseId: string | number;
  userAnswer: string | null;
  correct: boolean | null;
  reason: string;
  confidence: Confidence;
  tag: string;
  reasonScore: number;
  createdAt: number;
}

export interface SettingEntity {
  key: string;
  value: unknown;
  updatedAt: number;
}

class QuizDB extends Dexie {
  srsBoxes!: EntityTable<SrsBoxEntity, "id">;
  sessionLogs!: EntityTable<SessionLogEntity, "id">;
  settings!: EntityTable<SettingEntity, "key">;

  constructor() {
    super("kisokyu_quiz_db");
    this.version(1).stores({
      srsBoxes: "&id, updatedAt",
      sessionLogs: "++id, sessionStamp, createdAt",
      settings: "&key, updatedAt",
    });
  }
}

export const db = new QuizDB();

export async function loadSrsMap(): Promise<Record<string, number>> {
  const pairs = await db.srsBoxes.toArray();
  const map: Record<string, number> = {};
  for (const row of pairs) {
    map[row.id] = row.box;
  }
  return map;
}

export async function saveSrsMap(map: Record<string, number>): Promise<void> {
  const rows: SrsBoxEntity[] = Object.entries(map).map(([id, box]) => ({
    id,
    box,
    updatedAt: Date.now(),
  }));
  if (rows.length) {
    await db.srsBoxes.bulkPut(rows);
  }
}

export async function appendSessionLogs(logs: SessionLogEntity[]): Promise<void> {
  if (!logs.length) return;
  await db.sessionLogs.bulkAdd(logs);
}
