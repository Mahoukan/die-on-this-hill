'use client';

import { useId, useState } from 'react';
import type { QuestionMode, QuestionPackMeta } from '../shared/types';
import { groupQuestionPacks, selectPackGroup } from '../shared/pack-selection';

interface PackSelectorProps {
  packs: QuestionPackMeta[];
  selectedIds: string[];
  mode: QuestionMode;
  disabled: boolean;
  onChange: (ids: string[]) => void;
}

export function PackSelector({ packs, selectedIds, mode, disabled, onChange }: PackSelectorProps) {
  const prefix = useId();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const mixed = mode === 'mixed';
  const controls = (scope: QuestionPackMeta[], label: string) => <div className="pack-selection-actions" role="group" aria-label={`${label} selection`}>
    <button type="button" className="btn btn-ghost btn-small" disabled={disabled} onClick={() => onChange(selectPackGroup(selectedIds, scope, true))}>Select All</button>
    <button type="button" className="btn btn-ghost btn-small" disabled={disabled} onClick={() => onChange(selectPackGroup(selectedIds, scope, false))}>Deselect All</button>
  </div>;

  return <div className="pack-selector">
    {mixed && <div className="pack-selection-toolbar"><span>Select at least two packs.</span>{controls(packs, 'All packs')}</div>}
    {groupQuestionPacks(packs).map((group) => {
      const expanded = !collapsed[group.id];
      const selectedCount = group.packs.filter((pack) => selectedIds.includes(pack.id)).length;
      const selection = selectedCount === 0 ? 'None selected' : selectedCount === group.packs.length ? 'All selected' : 'Some selected';
      const headingId = `${prefix}-${group.id}-heading`;
      const panelId = `${prefix}-${group.id}-packs`;
      return <section className="pack-group" key={group.id} aria-labelledby={headingId}>
        <div className="pack-group-header">
          <h3><button type="button" id={headingId} className="pack-group-toggle" aria-expanded={expanded} aria-controls={panelId} onClick={() => setCollapsed((previous) => ({ ...previous, [group.id]: !previous[group.id] }))}>
            <span className="pack-disclosure" aria-hidden="true" /><span>{group.label}<small>{selection}, {selectedCount} of {group.packs.length}</small></span>
          </button></h3>
          {mixed && controls(group.packs, group.label)}
        </div>
        <div id={panelId} hidden={!expanded}>
          <div className="pack-grid">{group.packs.map((pack) => {
            const selected = selectedIds.includes(pack.id);
            return <button type="button" key={pack.id} className={`pack-card${selected ? ' is-selected' : ''}`} aria-pressed={selected} disabled={disabled} onClick={() => onChange(mixed ? selectPackGroup(selectedIds, [pack], !selected) : [pack.id])}>
              <span className="pack-check" aria-hidden="true">{selected ? 'Selected' : 'Add'}</span><strong>{pack.name}</strong><span>{pack.description}</span><small>{pack.custom ? 'Custom Pack' : 'Built-in'}, {pack.questionCount} questions</small>
            </button>;
          })}</div>
        </div>
      </section>;
    })}
  </div>;
}
