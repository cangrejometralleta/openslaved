from pathlib import Path
import sys
root = Path(__file__).resolve().parents[1]
html = (root / 'index.html').read_text()
html = html.replace('<link rel="stylesheet" href="src/style.css">', '<style>\n' + (root / 'src/style.css').read_text() + '\n</style>')
for path in ['vendor/three.min.js', 'src/audio.js', 'src/tab-audio.js', 'src/engine.js']:
    html = html.replace('<script src="' + path + '"></script>', '<script>\n' + (root / path).read_text() + '\n</script>')
license = (root / 'vendor/THREE-LICENSE.txt').read_text()
html = html.replace('</head>', '<!-- Three.js 0.160.1 (MIT), bundled for offline use.\n' + license + '-->\n</head>')
output = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'dist/openslaved.html'
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(html)
print(output)
