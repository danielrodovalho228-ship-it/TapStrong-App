/**
 * "Today's muscle" facts (Phase 27, C1): 30 short, true facts about the
 * muscle a workout worked most. Anatomy only: no health promise, no body
 * ideal. Texts are `moments.facts.<id>` in every language. `muscles` are
 * keys from the muscles table; "*" fits any workout.
 */
export type Fact = { id: string; muscles: string[] };

export const FACTS: readonly Fact[] = [
  { id: 'f01', muscles: ['glutes'] },
  { id: 'f02', muscles: ['glutes'] },
  { id: 'f03', muscles: ['quads'] },
  { id: 'f04', muscles: ['quads'] },
  { id: 'f05', muscles: ['hamstrings'] },
  { id: 'f06', muscles: ['hamstrings'] },
  { id: 'f07', muscles: ['calves'] },
  { id: 'f08', muscles: ['calves'] },
  { id: 'f09', muscles: ['lats'] },
  { id: 'f10', muscles: ['lats'] },
  { id: 'f11', muscles: ['traps'] },
  { id: 'f12', muscles: ['upperBack'] },
  { id: 'f13', muscles: ['lowerBack'] },
  { id: 'f14', muscles: ['chest', 'upperChest', 'midChest', 'lowerChest'] },
  { id: 'f15', muscles: ['chest', 'upperChest', 'midChest', 'lowerChest'] },
  { id: 'f16', muscles: ['shoulders', 'rearDelts'] },
  { id: 'f17', muscles: ['shoulders'] },
  { id: 'f18', muscles: ['rearDelts'] },
  { id: 'f19', muscles: ['rotatorCuff', 'shoulders', 'rearDelts'] },
  { id: 'f20', muscles: ['biceps'] },
  { id: 'f21', muscles: ['biceps'] },
  { id: 'f22', muscles: ['triceps'] },
  { id: 'f23', muscles: ['forearms'] },
  { id: 'f24', muscles: ['abs', 'upperAbs', 'lowerAbs'] },
  { id: 'f25', muscles: ['abs', 'upperAbs', 'lowerAbs'] },
  { id: 'f26', muscles: ['obliques'] },
  { id: 'f27', muscles: ['adductors'] },
  { id: 'f28', muscles: ['hips'] },
  { id: 'f29', muscles: ['shins'] },
  { id: 'f30', muscles: ['*'] },
];

/** Facts for a muscle (its own, else the ones that fit any workout). */
export function factsFor(muscle: string | null | undefined): Fact[] {
  const own = muscle ? FACTS.filter((f) => f.muscles.includes(muscle)) : [];
  return own.length ? own : FACTS.filter((f) => f.muscles.includes('*'));
}
