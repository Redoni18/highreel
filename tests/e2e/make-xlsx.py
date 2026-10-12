# A farm's own sheet for the column-mapping check: Albanian/English headers,
# real Excel dates (shown as DD/MM/YYYY), an extra column, a trailing empty row.
# Needs openpyxl (python3 -m pip install openpyxl).
import sys, datetime
from openpyxl import Workbook

wb = Workbook()
ws = wb.active
ws.title = 'Korrik 2026'
ws.append(['Nr', 'Emri', 'Parent email', 'Date', 'Ditët', 'Animals fed', 'Best moment', 'Grupi', 'Shënim'])
kids = [
    ('Arta', 2, 14, 'Feeding the baby goats', 'You were so brave with the pony!'),
    ('Dren', 1, 6, 'Collecting eggs', ''),
    ('Elira', 3, 21, 'Riding the pony', ''),
    ('Besnik', 2, 11, 'Milking a cow', 'Best helper of the week.'),
]
for i, (name, days, fed, moment, note) in enumerate(kids, start=1):
    ws.append([i, name, f'parent.{name.lower()}@example.com', datetime.date(2026, 7, 13 + i), days, fed, moment, 'Group A', note])
    ws.cell(row=i + 1, column=4).number_format = 'DD/MM/YYYY'
ws.append([None] * 9)
wb.save(sys.argv[1])
