"""Builds docs/review/launch-set.xlsx for the professional reviewer (Daniel, Oct 3).

Only the launch set (supabase/seed/launch_set.json, from `npm run launch-set`) is
reviewed before the first store release; the rest of the library follows in
later updates. Also writes docs/review/launch-set-flow.md: the launch-set
exercises still missing a clip, in priority order, for the Flow redo.

    python3 scripts/build-launch-sheet.py [--media-base https://<project>.supabase.co/storage/v1/object/public/exercise-media]

With --media-base, the clip and poster cells link to the uploaded files so the
reviewer can watch them.
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from review_common import *  # noqa: E402,F401,F403

parser = argparse.ArgumentParser()
parser.add_argument('--media-base', default='')
args = parser.parse_args()
BASE = args.media_base.rstrip('/')

launch = json.load(open(os.path.join(ROOT, 'supabase/seed/launch_set.json')))['exercises']
by_slug = {e['slug']: e for e in seed}
MEDIA = os.path.join(ROOT, 'assets/prototype')
qc = json.load(open(os.path.join(MEDIA, 'qc.json')))
files = set(os.listdir(MEDIA))
posters = set(os.listdir(os.path.join(MEDIA, 'posters')))
suspect = qc.get('suspect', {})


def has_clip(slug, sex):
    return f'{slug}.{sex}.mp4' in files and f'{slug}.{sex}' not in suspect


REASONS = {
    'clips': 'Has video (woman + man)',
    'first_workout': 'Can appear in a first workout',
    'shoulder': 'Shoulder program',
    'coverage': 'Muscle coverage (3 home + 3 gym)',
}
DECISIONS = ['Approve', 'Adjust', 'Reject']
WHERE = {'home': 'Home', 'gym': 'Gym', 'outdoors': 'Outdoors'}

COLS = [
    ('#', 6),
    ('ID (slug)', 26),
    ('Exercise', 30),
    ('Why in the launch set', 24),
    ('Video: woman', 16),
    ('Video: man', 16),
    ('Muscles (role, emphasis 0–1)', 44),
    ('Equipment', 20),
    ('Where', 14),
    ('Level (1–5)', 10),
    ('Minimum age', 13),
    ('Positions', 20),
    ('Contraindications', 32),
    ('Cue (tip shown to the user)', 46),
    ('Used as', 24),
    ('Joint movements (range)', 36),
    ('Decision: Approve / Adjust / Reject', 18),
    ('Comment', 44),
]
DECISION_COL = 17
COMMENT_COL = 18


def clip_cell(slug, sex):
    if not has_clip(slug, sex):
        return 'missing (coming)'
    if BASE:
        return f'=HYPERLINK("{BASE}/{slug}.{sex}.mp4","watch")'
    return f'{slug}.{sex}.mp4'


def row(n, item):
    e = by_slug[item['slug']]
    strings = en['exercises'][e['slug']]
    return [
        n,
        e['slug'],
        strings['name'],
        REASONS[item['reason']],
        clip_cell(e['slug'], 'f'),
        clip_cell(e['slug'], 'm'),
        muscles_text(e),
        ', '.join(EQUIPMENT[q] for q in e['equipment']) or 'Bodyweight',
        ', '.join(WHERE[w] for w in e['location']),
        e['level'],
        BANDS[e['minAgeBand']],
        ', '.join(POSITIONS[p] for p in e['positions']),
        ', '.join(RISK[c] for c in e['contraindications']) or 'None',
        strings['cues'],
        ', '.join(PARTS[p] for p in e['parts']),
        joints_text(e.get('joints', [])),
        None,
        None,
    ]


def header(ws, r, cols):
    for c, (title, width) in enumerate(cols, start=1):
        cell = ws.cell(row=r, column=c, value=title)
        cell.font = Font(name=FONT, bold=True, color='FFFFFF')
        cell.fill = HEADER_FILL
        cell.alignment = Alignment(wrap_text=True, vertical='center')
        cell.border = BORDER
        ws.column_dimensions[get_column_letter(c)].width = width


wb = Workbook()
guide = wb.active
guide.title = 'Instructions'
guide.column_dimensions['A'].width = 34
guide.column_dimensions['B'].width = 90
lines = [
    ('TapStrong — launch set review', True),
    ('', False),
    (f'{len(launch)} exercises go to the first store release. Nothing reaches users until you approve it.', False),
    ('', False),
    ('For each exercise, check', True),
    ('1. Muscles: right muscles, right role (primary / secondary / stabilizer), sensible emphasis.', False),
    ('2. Safety: minimum age, positions and contraindications. Anything missing?', False),
    ('3. Cue: the one-line tip is correct and safe.', False),
    ('4. Video (when there is a link): the movement shown matches the exercise and is done safely.', False),
    ('', False),
    ('How to fill it in', True),
    ('Only the two yellow columns on the "Launch set" tab: Decision (Approve / Adjust / Reject, from the list) '
     'and Comment. For Adjust or Reject, say why in the comment. Leave every other cell as it is.', False),
    ('Then write your name, credential (e.g. NSCA-CSCS, ACSM-CPT, PT license) and the date below.', False),
]
for i, (text, bold) in enumerate(lines, start=1):
    c = guide.cell(row=i, column=1, value=text)
    c.font = Font(name=FONT, bold=bold, size=14 if i == 1 else 11)
    guide.merge_cells(start_row=i, start_column=1, end_row=i, end_column=2)
    c.alignment = Alignment(wrap_text=True)

last = len(launch) + 1
rng = f"'Launch set'!$Q$2:$Q${last}"
s = len(lines) + 2
guide.cell(row=s, column=1, value='Progress (updates as you fill in)').font = Font(name=FONT, bold=True)
summary = [
    ('Exercises', f"=COUNTA('Launch set'!$B$2:$B${last})"),
    ('Approved', f'=COUNTIF({rng},"Approve")'),
    ('To adjust', f'=COUNTIF({rng},"Adjust")'),
    ('Rejected', f'=COUNTIF({rng},"Reject")'),
    ('Not reviewed yet', f'=B{s + 1}-B{s + 2}-B{s + 3}-B{s + 4}'),
]
for i, (label, formula) in enumerate(summary, start=1):
    guide.cell(row=s + i, column=1, value=label).font = Font(name=FONT)
    guide.cell(row=s + i, column=2, value=formula).font = Font(name=FONT, bold=True)

r = s + len(summary) + 2
guide.cell(row=r, column=1, value='Reviewer').font = Font(name=FONT, bold=True)
for i, label in enumerate(['Name', 'Credential', 'Date'], start=1):
    guide.cell(row=r + i, column=1, value=label).font = Font(name=FONT)
    cell = guide.cell(row=r + i, column=2)
    cell.fill = INPUT_FILL
    cell.font = Font(name=FONT)
    cell.border = BORDER
guide.cell(row=r + 2, column=2).comment = Comment(
    'Stored with each certified review (name + credential).', 'TapStrong'
)

ws = wb.create_sheet('Launch set')
header(ws, 1, COLS)
for n, item in enumerate(launch, start=1):
    for c, value in enumerate(row(n, item), start=1):
        cell = ws.cell(row=n + 1, column=c, value=value)
        cell.font = Font(name=FONT, color='0563C1', underline='single') if (
            isinstance(value, str) and value.startswith('=HYPERLINK')
        ) else Font(name=FONT)
        cell.alignment = Alignment(wrap_text=True, vertical='top')
        cell.border = BORDER
        if c in (DECISION_COL, COMMENT_COL):
            cell.fill = INPUT_FILL
ws.freeze_panes = 'D2'
ws.auto_filter.ref = f'A1:{get_column_letter(len(COLS))}{last}'
ws.row_dimensions[1].height = 32
dv = DataValidation(type='list', formula1='"' + ','.join(DECISIONS) + '"', allow_blank=True)
dv.error = 'Choose Approve, Adjust or Reject.'
dv.prompt = 'Approve, or Adjust / Reject and explain in Comment.'
ws.add_data_validation(dv)
dv.add(f'Q2:Q{last}')

out = os.path.join(ROOT, 'docs/review/launch-set.xlsx')
# The progress counts recalculate when the file is opened (Excel, Google Sheets).
wb.calculation.fullCalcOnLoad = True
wb.save(out)

# --- Flow redo list for the launch set -----------------------------------------
ORDER = ['first_workout', 'shoulder', 'coverage', 'clips']
LABEL = {
    'first_workout': 'Aparece no primeiro treino',
    'shoulder': 'Programa de ombro',
    'coverage': 'Cobertura de músculo',
    'clips': 'Tem clipe',
}
todo = []
for item in launch:
    slug = item['slug']
    for sex in ('f', 'm'):
        if not has_clip(slug, sex):
            why = suspect.get(f'{slug}.{sex}') or 'faltando'
            todo.append((ORDER.index(item['reason']), slug, sex, item['reason'], why))
todo.sort()
md = [
    '# Conjunto de lançamento: clipes para refazer no Flow',
    '',
    'Gerado por `python3 scripts/build-launch-sheet.py`. Não edite à mão.',
    '',
    f'Exercícios no conjunto: {len(launch)}. Clipes que faltam: {len(todo)} '
    f'(em {len({t[1] for t in todo})} exercícios).',
    '',
    'Ordem: primeiro treino, programa de ombro, cobertura de músculo. Sexo: f = mulher, m = homem.',
    'Nome do arquivo no Flow: `<slug>.<f|m>`.',
    '',
    '| # | slug | sexo | por que está no conjunto | motivo |',
    '|---|---|---|---|---|',
]
for i, (_, slug, sex, reason, why) in enumerate(todo, start=1):
    md.append(f'| {i} | {slug} | {sex} | {LABEL[reason]} | {why} |')
open(os.path.join(ROOT, 'docs/review/launch-set-flow.md'), 'w').write('\n'.join(md) + '\n')
print(f'wrote {len(launch)} exercises to {out}; {len(todo)} clips to redo in docs/review/launch-set-flow.md')

# --- The same list, one line per exercise, for the Flow redo (Daniel, Oct 3) ---
poster_suspect = qc.get('posterSuspect', {})
PRIORITY = {'first_workout': '1º treino', 'shoulder': 'ombro', 'coverage': 'cobertura', 'clips': 'tem clipe'}


def has_poster(slug, sex):
    return f'{slug}.{sex}.webp' in posters and f'{slug}.{sex}' not in poster_suspect


def reason_of(slug, sex):
    defect = suspect.get(f'{slug}.{sex}')
    return f'reprovado: {defect}' if defect else 'faltando'


by_slug_todo = {}
for _, slug, sex, reason, _why in todo:
    by_slug_todo.setdefault(slug, (reason, []))[1].append(sex)
lines = []
for slug, (reason, sexes) in by_slug_todo.items():
    sexes = sorted(sexes)
    sex_txt = 'fm' if sexes == ['f', 'm'] else sexes[0]
    imgs = [has_poster(slug, s) for s in sexes]
    img_txt = 'sim' if all(imgs) else 'não' if not any(imgs) else f'só {sexes[imgs.index(True)]}'
    reasons = {s: reason_of(slug, s) for s in sexes}
    if len(set(reasons.values())) == 1:
        why_txt = next(iter(reasons.values()))
    else:
        why_txt = '; '.join(f'{s}: {r}' for s, r in reasons.items())
    lines.append(f'{slug} | {sex_txt} | {PRIORITY[reason]} | {img_txt} | {why_txt}')
redo = [
    '# Clipes para refazer no Flow: conjunto de lançamento',
    '',
    'Gerado por `python3 scripts/build-launch-sheet.py`. Não edite à mão.',
    '',
    f'{len(todo)} clipes em {len(lines)} exercícios. Primeiro os do 1º treino, depois os do ombro.',
    '',
    'Formato: slug | sexo (f/m/fm) | prioridade | tem imagem de partida? (sim/não/só f/só m) | motivo',
    '',
    '```',
    *lines,
    '```',
]
open(os.path.join(ROOT, 'docs/media-redo-launch.md'), 'w').write('\n'.join(redo) + '\n')
print(f'{len(lines)} exercises in docs/media-redo-launch.md')

# --- Flow data per exercise, for Moacir (Daniel, Oct 4) -----------------------
# [slug, name, start position, setting, equipment, primary, secondary, view,
#  hold 0/1, unilateral 0/1, "L"]; staging hand-written in
# scripts/data/flow-launch-staging.json, the rest from the seed.
staging = json.load(open(os.path.join(ROOT, 'scripts/data/flow-launch-staging.json')))
SETTING = {
    'st': 'standing',
    'ch': 'seated on a plain armless chair or bench',
    'mat': 'on an exercise mat on the floor',
    'mc': 'using the machine',
}
missing_staging = [slug for slug in by_slug_todo if slug not in staging]
if missing_staging:
    sys.exit(f'add Flow staging for: {", ".join(missing_staging)} (scripts/data/flow-launch-staging.json)')
rows_json = []
for slug in by_slug_todo:
    e = by_slug[slug]
    start, setting, view, hold = staging[slug]
    muscles = lambda role: ', '.join(MUSCLE[k] for k, r, _ in e['muscles'] if (r == 'primary') == (role == 'primary'))
    row = [
        slug,
        en['exercises'][slug]['name'],
        start,
        SETTING[setting],
        ', '.join(EQUIPMENT[q] for q in e['equipment']),
        muscles('primary'),
        muscles('secondary'),
        view,
        hold,
        int(e['unilateral']),
        'L',
    ]
    rows_json.append(f'  {json.dumps(slug)}: {json.dumps(row, ensure_ascii=False)}')
open(os.path.join(ROOT, 'docs/media-redo-launch.json'), 'w').write('{\n' + ',\n'.join(rows_json) + '\n}\n')
print(f'{len(rows_json)} exercises in docs/media-redo-launch.json')
