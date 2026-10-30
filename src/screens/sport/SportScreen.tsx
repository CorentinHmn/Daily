/** Sport: Salle (programmes, live session, history) | Running (log, weekly distance). */
import { Dumbbell, Footprints } from 'lucide-react';
import { useApp } from '../../store/app';
import { SegmentedControl } from '../../ui/navigation';
import { PageHeader } from '../shell/PageHeader';
import { GymView } from './GymView';
import { SessionView } from './SessionView';
import { RunView } from './RunView';

export function SportScreen() {
  const view = useApp((s) => s.sportView);
  const active = useApp((s) => !!s.data.active);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Sport" subtitle="Programmes, séances et sorties running">
        <SegmentedControl
          label="Activité"
          value={view}
          onChange={(v) => useApp.getState().set({ sportView: v })}
          options={[
            { value: 'salle', label: 'Salle', icon: Dumbbell },
            { value: 'running', label: 'Running', icon: Footprints },
          ]}
        />
      </PageHeader>
      {view === 'salle' ? active ? <SessionView /> : <GymView /> : <RunView />}
    </div>
  );
}
