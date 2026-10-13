import type { PackDifficulty, QuestionPackMeta } from './types';

export interface PackGroup { id: PackDifficulty | 'custom'; label: string; packs: QuestionPackMeta[]; }

export function groupQuestionPacks(packs: readonly QuestionPackMeta[]): PackGroup[] {
  const groups: PackGroup[] = [
    { id: 'easy', label: 'Easy', packs: [] },
    { id: 'medium', label: 'Medium', packs: [] },
    { id: 'hard', label: 'Hard', packs: [] },
    { id: 'custom', label: 'Custom Packs', packs: [] },
  ];
  for (const pack of packs) groups.find((group) => group.id === (pack.custom ? 'custom' : pack.difficulty))?.packs.push(pack);
  return groups.filter((group) => group.packs.length > 0);
}

// Both global and group actions operate on the latest server selection.
export function selectPackGroup(selectedIds: readonly string[], packs: readonly QuestionPackMeta[], selected: boolean): string[] {
  const ids = new Set(packs.map((pack) => pack.id));
  return selected ? [...new Set([...selectedIds, ...ids])] : selectedIds.filter((id) => !ids.has(id));
}
