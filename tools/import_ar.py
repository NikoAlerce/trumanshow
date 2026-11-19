"""
Brings amAr's AR viewer for this cube into src/ar/ (the build copies it to ar/ in the zip, next to content/).

  python tools/import_ar.py [path to amAr] [--trabajo]     (default: ../amAr)

It runs amAr's herramientas/exportar.mjs on amAr's LAST COMMIT (--trabajo: its working folder, only to try
things out): the 'cubo' scene of the 'truman' project, in English, without the 8th Wall engine (its license
is revocable; this copy stays on IPFS for good), reading the cube from ../content/ and the EXIT sign's font
from ../fonts/. The build then fills in the list of the cube's files and their sizes (tools/build.py).
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
args = [a for a in sys.argv[1:] if not a.startswith("--")]
AMAR = Path(args[0]).resolve() if args else ROOT.parent / "amAr"

# what the AR page says (in amAr the scene's texts are in Spanish)
TEXTS = {
    "titulo": "Truman Show · EJX Cube",
    "leyenda": "Look ahead",
    "ayuda": "Six scenes from The Truman Show, one on each face of the cube. "
             "Walk around it; look from above, and crouch to see the bottom one.",
}

cmd = ["node", str(AMAR / "herramientas" / "exportar.mjs"), "truman", "cubo", str(ROOT / "src" / "ar"),
       "--idioma", "en", "--cubo", "../content/", "--fuentes", "../fonts/", "--miniatura", "../cover.jpg"]
for k, v in TEXTS.items():
    cmd += ["--" + k, v]
if "--trabajo" in sys.argv:
    cmd.append("--trabajo")
subprocess.run(cmd, check=True)
