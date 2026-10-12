# Writes public/fonts/caveat-notes.woff2: Caveat (OFL, google/fonts) at
# weight 400, cut down to printable ASCII and curly quotes/dashes, for the
# landing's handwritten notes. The full variable Caveat is 74 KB and loaded
# before the first paint; this subset is the same handwriting at a fraction of that.
#
#   python3 scripts/subset-caveat.py      # needs fonttools and brotli

import io
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

SOURCE = 'https://raw.githubusercontent.com/google/fonts/main/ofl/caveat/Caveat%5Bwght%5D.ttf'
OUT = Path(__file__).resolve().parent.parent / 'public' / 'fonts' / 'caveat-notes.woff2'

font = TTFont(io.BytesIO(urllib.request.urlopen(SOURCE).read()))
font = instancer.instantiateVariableFont(font, {'wght': 400})

options = subset.Options()
options.flavor = 'woff2'
# kerning only: Caveat's contextual alternates (calt) pull in hundreds of
# extra letter shapes; hinting doesn't help a 24 px script face
options.layout_features = ['kern']
options.hinting = False
options.name_IDs = ['*']
subsetter = subset.Subsetter(options)
subsetter.populate(unicodes=[*range(0x20, 0x7F), 0xA0, 0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026])
subsetter.subset(font)

OUT.parent.mkdir(parents=True, exist_ok=True)
font.flavor = 'woff2'
font.save(OUT)
print(f'{OUT.relative_to(OUT.parents[2])} {OUT.stat().st_size / 1024:.0f} KB')
