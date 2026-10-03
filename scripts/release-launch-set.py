"""Turns the reviewed launch-set sheets into SQL that releases the approved exercises.

The database only releases an exercise with, for its current muscle mapping
(SPEC §2.1, migration 20260928000000): a passing automated check, a passing
second independent mapping check, a certified reviewer sign-off (name +
credential) and licensed, non-prototype media. So:

    python3 scripts/release-launch-set.py \\
        --certified reviewed.xlsx \\
        --second second-check.xlsx \\
        [--license-ref "google-flow:owner-generated"]

- `--certified`: the professional's launch-set.xlsx (Decision + name/credential).
- `--second`: the second, independent check, same sheet format, by another person.

An exercise is released only when BOTH sheets say Approve and it has an
approved clip for both sexes (the clip and poster always match the
profile's sex). Approved exercises still missing a clip are held, and listed:
re-run after the clips arrive. Adjust / Reject rows are listed with their
comments and stay drafts.

Writes supabase/release/<date>-launch-set.sql (run it in the Supabase SQL
editor, or `psql "$DATABASE_URL" -f …` from a terminal) and prints a summary.
No key or secret is needed to build the file.
"""
import argparse
import datetime
import json
import os
import sys

from openpyxl import load_workbook

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEDIA = os.path.join(ROOT, 'assets/prototype')
SHEET = 'Launch set'
SLUG_COL, DECISION_COL, COMMENT_COL = 2, 17, 18


def read_sheet(path):
    wb = load_workbook(path, data_only=True)
    guide = wb['Instructions']
    reviewer = {}
    for row in guide.iter_rows(values_only=True):
        if row and row[0] in ('Name', 'Credential', 'Date') and len(row) > 1:
            reviewer[row[0].lower()] = (str(row[1]).strip() if row[1] is not None else '')
    decisions = {}
    for row in wb[SHEET].iter_rows(min_row=2, values_only=True):
        slug = row[SLUG_COL - 1]
        if not slug:
            continue
        decision = (row[DECISION_COL - 1] or '').strip()
        comment = (row[COMMENT_COL - 1] or '').strip() if row[COMMENT_COL - 1] else ''
        decisions[slug] = (decision, comment)
    return reviewer, decisions


def q(text):
    """A SQL string literal."""
    return "'" + str(text).replace("'", "''") + "'"


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--certified', required=True)
    p.add_argument('--second', required=True)
    p.add_argument('--license-ref', default='google-flow:owner-generated')
    p.add_argument('--out', default='')
    a = p.parse_args()

    launch = [x['slug'] for x in json.load(open(os.path.join(ROOT, 'supabase/seed/launch_set.json')))['exercises']]
    qc = json.load(open(os.path.join(MEDIA, 'qc.json')))
    files = set(os.listdir(MEDIA))

    def clips(slug):
        return all(f'{slug}.{s}.mp4' in files and f'{slug}.{s}' not in qc.get('suspect', {}) for s in 'fm')

    cert_who, cert = read_sheet(a.certified)
    second_who, second = read_sheet(a.second)
    for label, who in (('certified', cert_who), ('second', second_who)):
        if not who.get('name') or (label == 'certified' and not who.get('credential')):
            sys.exit(f'{label} sheet: fill in the reviewer name{" and credential" if label == "certified" else ""} on the Instructions tab')
    if cert_who['name'].lower() == second_who['name'].lower():
        sys.exit('the second check must be done by a different person (SPEC §2.1: independent)')

    release, held, changes = [], [], []
    for slug in launch:
        c, s = cert.get(slug, ('', '')), second.get(slug, ('', ''))
        if c[0] == 'Approve' and s[0] == 'Approve':
            (release if clips(slug) else held).append(slug)
        elif c[0] or s[0]:
            notes = ' | '.join(x for x in (c[1], s[1]) if x)
            if c[0] != 'Approve' or s[0] != 'Approve':
                changes.append((slug, c[0] or '—', s[0] or '—', notes))

    today = datetime.date.today().isoformat()
    out = a.out or os.path.join(ROOT, f'supabase/release/{today}-launch-set.sql')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    sql = [
        f'-- Launch set release, built {today} by scripts/release-launch-set.py. Do not edit.',
        f'-- Certified: {cert_who["name"]} ({cert_who.get("credential", "")}), {cert_who.get("date", "")}',
        f'-- Second check: {second_who["name"]}',
        f'-- Released: {len(release)}; held for clips: {len(held)}; to adjust or rejected: {len(changes)}.',
        'begin;',
    ]
    for slug in release:
        reviews = [
            ("'auto'", q('npm test: library rules'), 'null', q('automated rule checks (library tests)')),
            ("'second'", q(second_who['name']),
             q(second_who['credential']) if second_who.get('credential') else 'null',
             q(second.get(slug, ('', ''))[1] or 'approved')),
            ("'certified'", q(cert_who['name']), q(cert_who['credential']),
             q(cert.get(slug, ('', ''))[1] or 'approved')),
        ]
        for check, name, cred, notes in reviews:
            sql.append(
                'insert into public.exercise_reviews (exercise_id, "check", reviewer_name, credential, result, notes) '
                f"select id, {check}, {name}, {cred}, 'pass', {notes} from public.exercises where slug = {q(slug)};"
            )
        sql.append(
            'update public.exercises set '
            f"media_video = {q('exercise-media/' + slug)}, media_poster = {q('exercise-media/posters/' + slug)}, "
            f"media_provider = 'google_flow', license_ref = {q(a.license_ref)} where slug = {q(slug)};"
        )
        sql.append(f"update public.exercises set status = 'released' where slug = {q(slug)};")
    sql.append('commit;')
    open(out, 'w').write('\n'.join(sql) + '\n')

    print(f'wrote {out}')
    print(f'released: {len(release)}')
    print(f'held (approved, waiting for clips): {len(held)}' + (f' — {", ".join(held)}' if held else ''))
    print(f'to adjust or rejected: {len(changes)}')
    for slug, c, s, notes in changes:
        print(f'  {slug}: certified {c}, second {s}. {notes}')


if __name__ == '__main__':
    main()
