"""Builds docs/review/exercise-review.xlsx for the certified reviewer (SPEC §2.1).

Source: supabase/seed/exercises.json (the draft library),
supabase/seed/repair_tests.json (the draft Repair check tests),
supabase/seed/joint_movements.json (the draft movement catalog) and the English
strings in src/i18n/locales/en.json. Re-run after any library change:

    python3 scripts/build-review-sheet.py
"""
import json
import os

from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
seed = json.load(open(os.path.join(ROOT, 'supabase/seed/exercises.json')))['exercises']
repair = json.load(open(os.path.join(ROOT, 'supabase/seed/repair_tests.json')))['tests']
catalog = json.load(open(os.path.join(ROOT, 'supabase/seed/joint_movements.json')))
en = json.load(open(os.path.join(ROOT, 'src/i18n/locales/en.json')))

FONT = 'Arial'
HEADER_FILL = PatternFill('solid', fgColor='121212')
INPUT_FILL = PatternFill('solid', fgColor='FFF2CC')  # reviewer cells
THIN = Side(style='thin', color='DDD8D0')
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

BANDS = {
    'kid': '9+ (kids)',
    'teen': '13+ (teens)',
    'young': '18+',
    'adult': '30+',
    'mid': '45+',
    'senior': '60+',
    'elder': '75+',
}
POSITIONS = {'standing': 'Standing', 'with_support': 'With support', 'seated_only': 'Seated'}
PARTS = {
    'warmup_general': 'Warm-up: easy cardio',
    'warmup_mobility': 'Warm-up: mobility',
    'main': 'Main work',
    'finisher_cardio': 'Finisher: cardio',
    'finisher_mobility': 'Finisher: mobility',
    'cooldown_walk': 'Cool-down: walk',
    'cooldown_stretch': 'Cool-down: stretch',
    'cooldown_breathing': 'Cool-down: breathing',
}
# Detailed equipment names (improvements v1, C), from the English locale.
EQUIPMENT = en['equipment']
RISK = {**en['safety']['painAreas'], **en['safety']['conditions']}
MUSCLE = en['muscles']
ANATOMY = en['muscleAnatomy']

COLUMNS = [
    ('ID (slug)', 26),
    ('Exercise', 30),
    ('Muscles (role, emphasis 0–1)', 46),
    ('Equipment', 20),
    ('Level (1–5)', 10),
    ('Minimum age', 13),
    ('Positions', 22),
    ('Contraindications', 34),
    ('Cues', 48),
    ('Used as', 26),
    ('Joint movements (range)', 40),
    ('Shorter range allowed', 26),
    ('Approve / Fix (Aprovado/Corrigir)', 18),
    ('Comment (Comentário)', 44),
]
DECISION_COL = 13
COMMENT_COL = 14
MP = en['movementPain']
RANGES = {'full': 'full', 'partial': 'partial', 'isometric': 'hold, no movement'}


def movement_text(joint, movement):
    return f"{MP['joints'][joint]}: {MP['movements'][joint][movement]['name']}"


def joints_text(joints):
    return '\n'.join(f'{movement_text(j, m)} ({RANGES[r]})' for j, m, r in joints) or '—'


def muscles_text(entry):
    lines = []
    for key, role, emphasis in entry['muscles']:
        lines.append(f'{MUSCLE[key]} ({ANATOMY[key]}): {role}, {emphasis:.1f}')
    return '\n'.join(lines) or '— (breathing, no muscle mapping)'


def row_for(entry):
    return [
        entry['slug'],
        en['exercises'][entry['slug']]['name'],
        muscles_text(entry),
        ', '.join(EQUIPMENT[q] for q in entry['equipment']) or 'Bodyweight',
        entry['level'],
        BANDS[entry['minAgeBand']],
        ', '.join(POSITIONS[p] for p in entry['positions']),
        ', '.join(RISK[c] for c in entry['contraindications']) or 'None',
        en['exercises'][entry['slug']]['cues'],
        ', '.join(PARTS[p] for p in entry['parts'])
        + (' · recovery plan only' if entry.get('rehab') else ''),
        joints_text(entry.get('joints', [])),
        '\n'.join(movement_text(*k.split('.')) for k in entry.get('rangeLimit', [])) or '—',
        None,
        None,
    ]


def style_header(ws, row):
    for col, (title, width) in enumerate(COLUMNS, start=1):
        cell = ws.cell(row=row, column=col, value=title)
        cell.font = Font(name=FONT, bold=True, color='FFFFFF')
        cell.fill = HEADER_FILL
        cell.alignment = Alignment(wrap_text=True, vertical='center')
        cell.border = BORDER
        ws.column_dimensions[get_column_letter(col)].width = width


def style_row(ws, row, reviewer_cells=True):
    for col in range(1, len(COLUMNS) + 1):
        cell = ws.cell(row=row, column=col)
        cell.font = Font(name=FONT)
        cell.alignment = Alignment(wrap_text=True, vertical='top')
        cell.border = BORDER
        if reviewer_cells and col in (DECISION_COL, COMMENT_COL):
            cell.fill = INPUT_FILL


wb = Workbook()

# --- Instructions ------------------------------------------------------------
guide = wb.active
guide.title = 'Instructions'
guide.column_dimensions['A'].width = 110
lines = [
    ('TapStrong — exercise library review', True),
    ('', False),
    ('Every exercise below is a DRAFT. None reaches users until it passes three checks: an automated '
     'rule check (done), a second independent mapping check, and your certified sign-off.', False),
    ('', False),
    ('What to check for each exercise', True),
    ('1. Muscles: is each muscle right, with the right role (primary / secondary / stabilizer) and a '
     'sensible emphasis (0–1, primary ≥ 0.5)?', False),
    ('2. Safety: are the minimum age, positions and contraindications right? Anything missing?', False),
    ('3. Cues: is the one-line cue correct and safe?', False),
    ('4. Repair tests (tab "Repair tests"): are the protocol, the "good" target per age mode, the '
     'contraindications and the muscles each weak result sends to the 6-week plan right?', False),
    ('5. Joint movements: does each exercise and test list every joint movement it needs, with the '
     'right range? Is a shorter range really safe where it is allowed? Tab "Movements": are the '
     'movement list, the everyday examples, the red flags and the recovery phases right?', False),
    ('', False),
    ('How to fill it in', True),
    ('Only the two yellow columns on the "Exercises" tab: "Approve / Fix" (pick from the list) and '
     '"Comment". For "Fix", say what to change in the comment. Leave every other cell as it is.', False),
    ('', False),
    ('Example (not part of the library):', True),
]
for i, (text, bold) in enumerate(lines, start=1):
    c = guide.cell(row=i, column=1, value=text)
    c.font = Font(name=FONT, bold=bold, size=14 if i == 1 else 11)
    c.alignment = Alignment(wrap_text=True)

example_header = len(lines) + 1
for col, (title, width) in enumerate(COLUMNS, start=1):
    guide.column_dimensions[get_column_letter(col)].width = max(width, 110 if col == 1 else width)
style_header(guide, example_header)
example = [
    'example_squat', 'Example squat',
    'Quads (Quadriceps): primary, 1.0\nGlutes (Gluteus maximus and medius): secondary, 0.7',
    'Bodyweight', 1, '9+ (kids)', 'Standing, With support', 'Knee',
    'Sit back and down, knees over toes, then stand.', 'Main work',
    'Knee: Bend the knee deep (full)\nHip: Deep squat (full)', 'Knee: Bend the knee deep',
    'Fix', 'Add adductors as secondary, 0.3. Cue: keep heels down.',
]
for col, value in enumerate(example, start=1):
    guide.cell(row=example_header + 1, column=col, value=value)
style_row(guide, example_header + 1)

summary_row = example_header + 3
guide.cell(row=summary_row, column=1, value='Progress (updates as you fill in the Exercises tab)').font = Font(
    name=FONT, bold=True
)
count_range = f'Exercises!$M$2:$M${len(seed) + 1}'
summary = [
    ('Exercises', f'=COUNTA(Exercises!$A$2:$A${len(seed) + 1})'),
    ('Approved', f'=COUNTIF({count_range},"Approve")'),
    ('To fix', f'=COUNTIF({count_range},"Fix")'),
    ('Not reviewed yet', f'=B{summary_row + 1}-B{summary_row + 2}-B{summary_row + 3}'),
    ('Repair tests approved', f"=COUNTIF('Repair tests'!$J$2:$J${len(repair) + 1},\"Approve\")"),
    ('Movement rows approved', f"=COUNTIF(Movements!$E$2:$E$200,\"Approve\")"),
]
for i, (label, formula) in enumerate(summary, start=1):
    guide.cell(row=summary_row + i, column=1, value=label).font = Font(name=FONT)
    guide.cell(row=summary_row + i, column=2, value=formula).font = Font(name=FONT, bold=True)

reviewer_row = summary_row + len(summary) + 2
guide.cell(row=reviewer_row, column=1, value='Reviewer name, credential and date').font = Font(
    name=FONT, bold=True
)
sign = guide.cell(row=reviewer_row + 1, column=1)
sign.fill = INPUT_FILL
sign.font = Font(name=FONT)
sign.comment = Comment('Stored with each certified review (name + credential, e.g. NSCA-CSCS).', 'TapStrong')

# --- Exercises -----------------------------------------------------------------
ws = wb.create_sheet('Exercises')
style_header(ws, 1)
for r, entry in enumerate(seed, start=2):
    for col, value in enumerate(row_for(entry), start=1):
        ws.cell(row=r, column=col, value=value)
    style_row(ws, r)
ws.freeze_panes = 'C2'
ws.auto_filter.ref = f'A1:{get_column_letter(len(COLUMNS))}{len(seed) + 1}'
ws.row_dimensions[1].height = 32

decision = DataValidation(type='list', formula1='"Approve,Fix"', allow_blank=True)
decision.error = 'Choose Approve or Fix.'
decision.prompt = 'Approve, or Fix and explain in Comment.'
ws.add_data_validation(decision)
decision.add(f'M2:M{len(seed) + 1}')
guide_decision = DataValidation(type='list', formula1='"Approve,Fix"', allow_blank=True)
guide.add_data_validation(guide_decision)
guide_decision.add(f'M{example_header + 1}')

# --- Repair tests ----------------------------------------------------------------
REPAIR_COLUMNS = [
    ('ID', 20),
    ('Test', 26),
    ('How (shown to the user)', 52),
    ('Result recorded', 24),
    ('Positions', 22),
    ('Contraindications', 30),
    ('"Good" target by mode (kids / teens / adults / 60+)', 30),
    ('Weak result → plan focus', 40),
    ('Joint movements (range)', 36),
    ('Approve / Fix (Aprovado/Corrigir)', 18),
    ('Comment (Comentário)', 44),
]
KINDS = {
    'reps': 'Reps in {s} s',
    'hold': 'Hold time, seconds (max {s})',
    'sides_hold': 'Hold time per side, seconds (max {s})',
    'sides_pass': 'Reached / limited, per side',
}
GOALS = en['muscleGoals']


def repair_row(t):
    good = t.get('good')
    unit = 'reps' if t['kind'] == 'reps' else 's'
    target = (
        ' / '.join(f"{good[m]} {unit}" for m in ('child', 'teen', 'adult', 'senior'))
        if good else 'Both sides reached'
    )
    focus = f"{GOALS[t['focus']['goal']]}: " + ', '.join(MUSCLE[m] for m in t['focus']['muscles'])
    return [
        t['key'],
        en['repair']['tests'][t['key']]['name'],
        en['repair']['tests'][t['key']]['how'],
        KINDS[t['kind']].format(s=t.get('seconds', '')),
        ', '.join(POSITIONS[p] for p in t['positions']),
        ', '.join(RISK[c] for c in t['contraindications']) or 'None',
        target,
        focus,
        joints_text(t.get('joints', [])),
        None,
        None,
    ]


rt = wb.create_sheet('Repair tests')
for col, (title, width) in enumerate(REPAIR_COLUMNS, start=1):
    cell = rt.cell(row=1, column=col, value=title)
    cell.font = Font(name=FONT, bold=True, color='FFFFFF')
    cell.fill = HEADER_FILL
    cell.alignment = Alignment(wrap_text=True, vertical='center')
    cell.border = BORDER
    rt.column_dimensions[get_column_letter(col)].width = width
for r, t in enumerate(repair, start=2):
    for col, value in enumerate(repair_row(t), start=1):
        cell = rt.cell(row=r, column=col, value=value)
        cell.font = Font(name=FONT)
        cell.alignment = Alignment(wrap_text=True, vertical='top')
        cell.border = BORDER
        if col >= len(REPAIR_COLUMNS) - 1:
            cell.fill = INPUT_FILL
rt.freeze_panes = 'C2'
rt.row_dimensions[1].height = 32
repair_decision = DataValidation(type='list', formula1='"Approve,Fix"', allow_blank=True)
rt.add_data_validation(repair_decision)
repair_decision.add(f'J2:J{len(repair) + 1}')

# --- Movements (catalog) -------------------------------------------------------
mv = wb.create_sheet('Movements')
MV_COLUMNS = [
    ('Joint', 16),
    ('Movement (key)', 26),
    ('Shown to the user', 30),
    ('Everyday example', 50),
    ('Approve / Fix (Aprovado/Corrigir)', 18),
    ('Comment (Comentário)', 44),
]
for col, (title, width) in enumerate(MV_COLUMNS, start=1):
    cell = mv.cell(row=1, column=col, value=title)
    cell.font = Font(name=FONT, bold=True, color='FFFFFF')
    cell.fill = HEADER_FILL
    cell.alignment = Alignment(wrap_text=True, vertical='center')
    cell.border = BORDER
    mv.column_dimensions[get_column_letter(col)].width = width
rows = []
for joint, entry in catalog['joints'].items():
    for m in entry['movements']:
        rows.append([MP['joints'][joint], f'{joint}.{m}', MP['movements'][joint][m]['name'],
                     MP['movements'][joint][m]['example'], None, None])
rows.append(['Red flags', '—', 'No plan, see a doctor, if any applies:',
             '\n'.join(MP['redFlags'][f] for f in catalog['redFlags']), None, None])
for phase in ('1', '2', '3'):
    focus = '; '.join(
        f"{MP['joints'][j]}: " + ', '.join(MUSCLE[m] for m in e['focus'][phase])
        for j, e in catalog['joints'].items()
    )
    rows.append([f'Recovery phase {phase}', '—', MP['plan']['phases'][phase], focus, None, None])
rows.append(['Traffic light', '—', MP['plan']['lightRule'],
             'Levels 1–6: green +1, yellow hold, red −1. Phase 1 = levels 1–2, 2 = 3–4, 3 = 5–6. '
             'Pain 7+ leaves the whole joint out; holds and shorter range only at pain 5 or less.',
             None, None])
rows.append(['Physical therapist', '—', MP['plan']['seePT'],
             'Recommended when the weekly retest is worse than at the start, or no better after 3 weeks.',
             None, None])
for r, values in enumerate(rows, start=2):
    for col, value in enumerate(values, start=1):
        cell = mv.cell(row=r, column=col, value=value)
        cell.font = Font(name=FONT)
        cell.alignment = Alignment(wrap_text=True, vertical='top')
        cell.border = BORDER
        if col >= len(MV_COLUMNS) - 1:
            cell.fill = INPUT_FILL
mv.freeze_panes = 'C2'
mv_decision = DataValidation(type='list', formula1='"Approve,Fix"', allow_blank=True)
mv.add_data_validation(mv_decision)
mv_decision.add(f'E2:E{len(rows) + 1}')

# The progress counters are recalculated by Excel / Google Sheets on open.
wb.calculation.fullCalcOnLoad = True

out = os.path.join(ROOT, 'docs/review/exercise-review.xlsx')
os.makedirs(os.path.dirname(out), exist_ok=True)
wb.save(out)
print(f'wrote {len(seed)} exercises, {len(repair)} Repair tests and the movement catalog to {os.path.relpath(out, ROOT)}')
