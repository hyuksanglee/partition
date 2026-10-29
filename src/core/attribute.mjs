// 오른 사용률(%p)을 프로젝트별 대기분 토큰 비중대로 나눈다. 순수 함수.

/**
 * @param {number} deltaPp 이번에 오른 %p
 * @param {Record<string, number>} pending 프로젝트별 가중 토큰
 * @returns {{ byProject: Record<string, number>, unattributed: number }}
 */
export function attribute(deltaPp, pending) {
  if (!(deltaPp > 0)) return { byProject: {}, unattributed: 0 };
  const total = Object.values(pending).reduce((a, b) => a + Math.max(0, b), 0);
  if (total <= 0) return { byProject: {}, unattributed: deltaPp };
  /** @type {Record<string, number>} */
  const byProject = {};
  for (const [project, weight] of Object.entries(pending)) {
    if (weight > 0) byProject[project] = (deltaPp * weight) / total;
  }
  return { byProject, unattributed: 0 };
}
