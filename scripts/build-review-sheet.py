"""Builds docs/review/exercise-review.xlsx for the certified reviewer (SPEC §2.1).

Source: supabase/seed/exercises.json (the draft library) and the English
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
EQUIPMENT = {
    'dumbbells': 'Dumbbells', 'barbell': 'Barbell', 'kettlebell': 'Kettlebell', 'bands': 'Bands',
    'machines': 'Machine', 'cables': 'Cable', 'bench': 'Bench', 'pull_up_bar': 'Pull-up bar',
    'mat': 'Mat',
}
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
    ('Approve / Fix (Aprovado/Corrigir)', 18),
    ('Comment (Comentário)', 44),
]
DECISION_COL = 11
COMMENT_COL = 12


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
        ', '.join(PARTS[p] for p in entry['parts']),
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
    'Fix', 'Add adductors as secondary, 0.3. Cue: keep heels down.',
]
for col, value in enumerate(example, start=1):
    guide.cell(row=example_header + 1, column=col, value=value)
style_row(guide, example_header + 1)

summary_row = example_header + 3
guide.cell(row=summary_row, column=1, value='Progress (updates as you fill in the Exercises tab)').font = Font(
    name=FONT, bold=True
)
count_range = f'Exercises!$K$2:$K${len(seed) + 1}'
summary = [
    ('Exercises', f'=COUNTA(Exercises!$A$2:$A${len(seed) + 1})'),
    ('Approved', f'=COUNTIF({count_range},"Approve")'),
    ('To fix', f'=COUNTIF({count_range},"Fix")'),
    ('Not reviewed yet', f'=B{summary_row + 1}-B{summary_row + 2}-B{summary_row + 3}'),
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
decision.add(f'K2:K{len(seed) + 1}')
guide_decision = DataValidation(type='list', formula1='"Approve,Fix"', allow_blank=True)
guide.add_data_validation(guide_decision)
guide_decision.add(f'K{example_header + 1}')

# The progress counters are recalculated by Excel / Google Sheets on open.
wb.calculation.fullCalcOnLoad = True

out = os.path.join(ROOT, 'docs/review/exercise-review.xlsx')
os.makedirs(os.path.dirname(out), exist_ok=True)
wb.save(out)
print(f'wrote {len(seed)} exercises to {os.path.relpath(out, ROOT)}')
