import type { EvidenceState, SourceHealth, SourceStatus, UniversityState } from './types';

export const stateCopy: Record<UniversityState, { label: string; description: string }> = {
  'official-list': { label: '公开院校 List', description: '已找到大学公开发布的院校名单或分组信息。' },
  'china-requirements': { label: '中国申请要求', description: '已找到面向中国申请者的官方要求，未确认完整院校 List。' },
  'faculty-only': { label: '部分学院公开', description: '公开信息只适用于部分学院、专业或课程。' },
  'not-public': { label: '未发现公开 List', description: '暂未发现公开院校名单，不代表学校不接受申请。' },
  pending: { label: '待确认', description: '官方来源仍在核验中，不代表学校不接受申请。' },
};

export const sourceHealthCopy: Record<SourceHealth, string> = {
  ok: '链接正常',
  redirected: '链接已跳转',
  changed: '内容疑似更新',
  'temporary-error': '暂时无法检查',
  unavailable: '链接暂不可用',
  unchecked: '尚未检查',
};

export const evidenceStateCopy: Record<EvidenceState, { label: string; description: string }> = {
  'official-match': { label: '公开 List 中找到', description: '在大学公开发布的院校名单或要求中找到该院校。' },
  'faculty-match': { label: '院系/专业范围内找到', description: '公开信息适用范围为特定院系、专业或课程。' },
  'not-found-in-public-list': { label: '公开 List 中暂未找到', description: '已检查健康的学校层面公开 List，暂未找到该院校。' },
  'no-public-list': { label: '未发现公开 List', description: '当前未发现可核验的学校层面公开 List。' },
  'source-changed': { label: '来源已变更', description: '官方来源内容疑似更新，需重新核验。' },
  'source-unavailable': { label: '来源暂不可用', description: '官方来源暂时无法访问或检查。' },
};

export const directoryFilters = [
  ['all', '全部'],
  ['official-list', stateCopy['official-list'].label],
  ['china-requirements', stateCopy['china-requirements'].label],
  ['faculty-only', stateCopy['faculty-only'].label],
  ['not-public', stateCopy['not-public'].label],
  ['pending', stateCopy.pending.label],
] as const;

export function sourceFreshnessCopy(status?: SourceStatus): string {
  if (status?.lastSuccessfulAt) {
    return `最近成功检查：${status.lastSuccessfulAt.slice(0, 10)}`;
  }
  if (status?.checkedAt) {
    return `最近检查：${status.checkedAt.slice(0, 10)}`;
  }
  return '尚无检查时间';
}
