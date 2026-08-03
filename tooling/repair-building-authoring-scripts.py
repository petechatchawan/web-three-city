from pathlib import Path

FILES = [
    Path('tooling/generate-building-foundation-part1.mjs'),
    Path('tooling/generate-building-foundation-part2.mjs'),
    Path('tooling/generate-building-foundation-part3.mjs'),
]

for path in FILES:
    lines = path.read_text(encoding='utf-8').splitlines(keepends=True)
    source = ''.join(
        line
        for line in lines
        if not ('source.indexOf(search, index + search.length)' in line and 'ambiguous-pattern' in line)
    )
    cursor = 0
    pieces: list[str] = []
    while True:
        call = source.find('await write(', cursor)
        if call < 0:
            pieces.append(source[cursor:])
            break
        opening = source.find('`', call)
        closing = source.find('\n`,\n);', opening + 1)
        if opening < 0 or closing < 0:
            raise RuntimeError(f'repair:unclosed-write-template:{path}:{call}')
        pieces.append(source[cursor:opening + 1])
        content = source[opening + 1:closing]
        content = content.replace('\\`', '`').replace('\\${', '${')
        content = content.replace('`', '\\`').replace('${', '\\${')
        pieces.append(content)
        pieces.append(source[closing:closing + 5])
        cursor = closing + 5
    path.write_text(''.join(pieces), encoding='utf-8')
    print(f'Repaired {path}')
