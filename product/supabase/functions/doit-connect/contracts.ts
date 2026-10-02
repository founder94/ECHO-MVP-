// Contract candidates: caller must persist under DB transaction/CAS. These pure functions are NOT a production ledger.
export type Participant = 'a' | 'b';
export interface Mission { id: string; connection_id: string; participants: { a: string; b: string }; state: 'assigned' | 'completed' | 'cancelled'; completed: { a: boolean; b: boolean }; reward_reference: string | null }
export function completeMission(mission: Mission, actor: string): Mission {
  const side = actor === mission.participants.a ? 'a' : actor === mission.participants.b ? 'b' : null;
  if (!side) throw new Error('NOT_PARTICIPANT');
  if (mission.participants.a === mission.participants.b) throw new Error('INVALID_PARTICIPANTS');
  if (mission.state === 'cancelled') throw new Error('MISSION_CLOSED');
  const completed = { ...mission.completed, [side]: true };
  const both = completed.a && completed.b;
  return { ...mission, completed, state: both ? 'completed' : 'assigned', reward_reference: both ? `mission:${mission.id}:completed` : null };
}
export interface TogetherExit { connection_id: string; participants: { a: string; b: string }; agreed: { a: boolean; b: boolean }; outcome: 'pending' | 'left_together' }
export function agreeTogetherExit(exit: TogetherExit, actor: string): TogetherExit {
  const side = actor === exit.participants.a ? 'a' : actor === exit.participants.b ? 'b' : null;
  if (!side || exit.participants.a === exit.participants.b) throw new Error('NOT_PARTICIPANT');
  const agreed = { ...exit.agreed, [side]: true };
  // Deliberately has no account action. Another person's consent can never authorize account deletion.
  return { ...exit, agreed, outcome: agreed.a && agreed.b ? 'left_together' : 'pending' };
}
export type KeyTarget = 'scene' | 'profile_layer' | 'photo_fragment' | 'special_question' | 'special_experience';
export function validateKeyTarget(target: string): asserts target is KeyTarget {
  if (!['scene', 'profile_layer', 'photo_fragment', 'special_question', 'special_experience'].includes(target)) throw new Error('KEY_TARGET_FORBIDDEN');
}
export interface KeyTransaction { user_id: string; amount: number; transaction_type: 'grant' | 'spend' | 'refund'; source: 'purchase' | 'reward' | 'promotion' | 'refund' | 'admin'; target: KeyTarget | null; reference_id: string; idempotency_key: string; created_at: string }
export interface RewardEvent { reward_event: string; reward_type: string; source: 'mission' | 'outcome' | 'profile_completion'; user_id: string; connection_id: string | null; reference_id: string; idempotency_key: string; granted_at: string }
export interface ReputationReceipt { user_id: string; axis: 'trust' | 'activity' | 'support'; source: string; reference_id: string; evidence_id: string }
export function validateReceipt(receipt: ReputationReceipt) {
  if (['purchase', 'membership', 'paid_experience'].includes(receipt.source) && receipt.axis !== 'support') throw new Error('SUPPORT_IS_NOT_TRUST');
  if (receipt.axis === 'activity' && ['message_count', 'click_count', 'login_count'].includes(receipt.source)) throw new Error('SPAM_IS_NOT_ACTIVITY');
  if (!receipt.reference_id || !receipt.evidence_id) throw new Error('EVIDENCE_REQUIRED');
}
