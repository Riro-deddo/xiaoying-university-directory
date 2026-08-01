import type { SourceHealth, UniversityState } from './types';

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
