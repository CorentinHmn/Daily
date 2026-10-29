import { describe, expect, it } from 'vitest';
import { goalProgress, monthlySeries, weeklySeries } from './stats';
import { goalFor, goalOwners } from './people';
import { NOUS } from './types';

describe('séries', () => {
  it('mois : du plus ancien au mois en cours, avec leurs bornes', () => {
    const ranges: string[] = [];
    const s = monthlySeries(3, (from, to) => (ranges.push(`${from}/${to}`), ranges.length), '2026-01-15');
    expect(s.map((x) => x.month)).toEqual(['2025-11-01', '2025-12-01', '2026-01-01']);
    expect(ranges).toEqual(['2025-11-01/2025-11-30', '2025-12-01/2025-12-31', '2026-01-01/2026-01-31']);
  });
  it('semaines : lundis, la dernière est la semaine en cours', () => {
    expect(weeklySeries(2, () => 0, '2026-10-29').map((x) => x.week)).toEqual(['2026-10-19', '2026-10-26']);
  });
});

describe('objectif à plusieurs', () => {
  const base = { id: 'g', title: 'Courir', period: 'semaine' as const, kind: 'auto' as const, source: 'km' as const, target: 20, value: 0, steps: [], icon: 'target' as const };
  const runs = [
    { id: '1', date: '2026-10-27', distanceKm: 5, durationMin: 30, owner: 'a' },
    { id: '2', date: '2026-10-28', distanceKm: 7, durationMin: 40, owner: 'b' },
    { id: '3', date: '2026-10-28', distanceKm: 9, durationMin: 50, owner: 'c' },
  ];
  const data = { runs, sessions: [], tasks: [] };
  it('compte les sorties de ses personnes, pas des autres', () => {
    expect(goalProgress({ ...base, owner: NOUS, owners: ['a', 'b'] }, data, '2026-10-29').value).toBe(12);
    expect(goalProgress({ ...base, owner: 'c' }, data, '2026-10-29').value).toBe(9);
    expect(goalProgress({ ...base, owner: NOUS }, data, '2026-10-29').value).toBe(21);
  });
  it('apparaît dans le filtre de chacune de ses personnes', () => {
    const g = { owner: NOUS, owners: ['a', 'b'] };
    expect(goalOwners(g)).toEqual(['a', 'b']);
    expect([goalFor(g, 'a'), goalFor(g, 'b'), goalFor(g, 'c'), goalFor(g, null)]).toEqual([true, true, false, true]);
    expect(goalFor({ owner: NOUS }, 'c')).toBe(true);
  });
});

describe('sortie à plusieurs', () => {
  const base = { id: 'g', title: 'Courir', period: 'semaine' as const, kind: 'auto' as const, source: 'km' as const, target: 20, value: 0, steps: [], icon: 'target' as const };
  const runs = [
    { id: '1', date: '2026-10-27', distanceKm: 10, durationMin: 55, owner: NOUS, owners: ['a', 'b'] },
    { id: '2', date: '2026-10-28', distanceKm: 4, durationMin: 25, owner: 'b' },
    { id: '3', date: '2026-10-28', distanceKm: 6, durationMin: 35, owner: NOUS },
  ];
  const data = { runs, sessions: [], tasks: [] };
  it('compte pour chacune de ses personnes, une fois pour le foyer', () => {
    expect(goalProgress({ ...base, owner: 'a' }, data, '2026-10-29').value).toBe(16);
    expect(goalProgress({ ...base, owner: 'b' }, data, '2026-10-29').value).toBe(20);
    expect(goalProgress({ ...base, owner: 'c' }, data, '2026-10-29').value).toBe(6);
    expect(goalProgress({ ...base, owner: NOUS }, data, '2026-10-29').value).toBe(20);
    expect(goalProgress({ ...base, source: 'sorties', owner: 'a' }, data, '2026-10-29').value).toBe(2);
  });
});
