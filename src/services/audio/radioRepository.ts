import type { RadioSession, RadioSessionStatus } from "../../types/audio";
import {
  audioDataSource,
  type AssignRadioSessionHostInput,
  type AudioServiceResult,
  type RadioListenerModerationAction,
  type RadioListenerState,
  type StartRadioSessionInput,
  type UpdateRadioScheduleInput,
} from "./audioDataSource";

export type RadioSessionListInput = Readonly<{ communityId?: string; statuses?: readonly RadioSessionStatus[] }>;

export interface RadioRepository {
  list(input?: RadioSessionListInput): Promise<AudioServiceResult<RadioSession[]>>;
  get(sessionId: string): Promise<AudioServiceResult<RadioSession>>;
  create(input: StartRadioSessionInput): Promise<AudioServiceResult<RadioSession>>;
  updateSchedule(sessionId: string, input: UpdateRadioScheduleInput): Promise<AudioServiceResult<RadioSession>>;
  cancelSchedule(sessionId: string): Promise<AudioServiceResult<RadioSession>>;
  start(sessionId: string): Promise<AudioServiceResult<RadioSession>>;
  end(sessionId: string): Promise<AudioServiceResult<RadioSession>>;
  join(sessionId: string): Promise<AudioServiceResult<boolean>>;
  leave(sessionId: string): Promise<AudioServiceResult<boolean>>;
  heartbeat(sessionId: string): Promise<AudioServiceResult<boolean>>;
  setSaved(sessionId: string, saved: boolean): Promise<AudioServiceResult<boolean>>;
  react(sessionId: string, emoji: string): Promise<AudioServiceResult<boolean>>;
  assignHost(input: AssignRadioSessionHostInput): Promise<AudioServiceResult<boolean>>;
  listListeners(sessionId: string): Promise<AudioServiceResult<RadioListenerState[]>>;
  moderateListener(sessionId: string, userId: string, action: RadioListenerModerationAction): Promise<AudioServiceResult<boolean>>;
}

export const radioRepository: RadioRepository = {
  async list(input = {}) {
    const result = await audioDataSource.listRadioSessions(input.communityId);
    if (!result.ok || !input.statuses?.length) return result;
    const statuses = new Set(input.statuses);
    return { ok: true, data: result.data.filter((session) => statuses.has(session.status)) };
  },
  get: (sessionId) => audioDataSource.getRadioSession(sessionId),
  create: (input) => audioDataSource.startRadioSession(input),
  updateSchedule: (sessionId, input) => audioDataSource.updateRadioSchedule(sessionId, input),
  cancelSchedule: (sessionId) => audioDataSource.cancelRadioSession(sessionId),
  start: (sessionId) => audioDataSource.startScheduledRadioSession(sessionId),
  end: (sessionId) => audioDataSource.endRadioSession(sessionId),
  join: (sessionId) => audioDataSource.setListening(sessionId, true),
  leave: (sessionId) => audioDataSource.setListening(sessionId, false),
  heartbeat: (sessionId) => audioDataSource.heartbeatRadioListener(sessionId),
  setSaved: (sessionId, saved) => audioDataSource.setRadioSaved(sessionId, saved),
  react: (sessionId, emoji) => audioDataSource.reactToRadioSession(sessionId, emoji),
  assignHost: (input) => audioDataSource.assignRadioSessionHost(input),
  listListeners: (sessionId) => audioDataSource.listRadioListeners(sessionId),
  moderateListener: (sessionId, userId, action) => audioDataSource.moderateRadioListener(sessionId, userId, action),
};
