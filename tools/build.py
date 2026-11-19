"""
Build script for the objkt version of the Truman Show EJX cube.

  python tools/build.py          -> rebuilds dist/ from original/ + src/
  python tools/build.py --zip    -> also writes trumanshow_objkt.zip
  python tools/build.py --pages  -> also copies the site to docs/ (GitHub Pages)

What it does
  * copies the EyeJack X player (index.html/js/css, fonts, icons, images)
  * converts content/app.json (46 MB of JSON floats + base64 PNGs) into
      - content/app.json   : scene graph + materials (small JSON)
      - content/scene.bin  : quantized geometry + animation keyframes
      - content/tex/*      : textures re-encoded as JPEG / WebP
  * removes the old static water mesh (the new animated ocean is built at runtime)
  * copies the runtime code from src/content/ (app.js + generated textures)
  * copies the AR view from src/ar/ (amAr's viewer for this cube, brought by tools/import_ar.py) to ar/,
    with the list of the content files it reads
"""
import base64
import io
import json
import shutil
import sys
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ORIG = ROOT / "original"
SRC = ROOT / "src"
DIST = ROOT / "dist"

# the loading bar of index.html (content/app.js fills it in; .wait = before it knows how far along)
LOADING_CSS = (
    # its own name for the player's DIN (the player declares "urwdin" only once its script runs);
    # the file is preloaded at once
    "@font-face{font-family:tl-din;src:url(./fonts/URWDIN-Demi.ttf) format('truetype');font-display:swap}"
    "#truman-loading{position:fixed;left:50%;bottom:max(16px,4vh);transform:translateX(-50%);width:min(300px,72vw);"
    "box-sizing:border-box;padding:10px 16px 12px;border-radius:12px;background:rgba(8,10,14,.66);"
    "-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:0 2px 18px rgba(0,0,0,.35);"
    "font:12px/1.25 tl-din,urwdin,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;letter-spacing:.14em;"
    "text-transform:uppercase;color:#fff;"
    "text-align:center;pointer-events:none;z-index:300;transition:opacity .5s ease}"
    "#truman-loading .tl-label{opacity:.92;white-space:nowrap}"
    "#truman-loading .tl-track{height:2px;margin-top:9px;background:rgba(255,255,255,.2);border-radius:2px;overflow:hidden}"
    "#truman-loading .tl-fill{height:100%;width:0;background:#fff;transition:width .35s ease}"
    "#truman-loading.wait .tl-fill{width:30%;animation:tl-wait 1.4s ease-in-out infinite}"
    "@keyframes tl-wait{from{transform:translateX(-110%)}to{transform:translateX(340%)}}"
)

# objects removed from the scene (replaced at runtime)
# the old static water plane and the old 3D subtitles (replaced by the sky writing)
REMOVE_OBJECTS = {"Plane", "letrasd.glb"}
# images that are no longer referenced once the wall gets its new material
DROP_TEXTURE_NAMES = {"ChatGPT Image Jun 14, 2025, 04_43_55 PM"}
# max texture size per texture name (others keep their size)
MAX_SIZE = {"Image_0": 1024, "Image_1": 1024, "Image_2": 1024}
HEADPHONE_IMAGES_MAX = 512


class Bin:
    """Accumulates typed binary chunks, 4-byte aligned."""

    def __init__(self):
        self.buf = bytearray()

    def add(self, arr: np.ndarray) -> int:
        while len(self.buf) % 4:
            self.buf.append(0)
        off = len(self.buf)
        self.buf += arr.tobytes()
        return off


def quantize_attr(name, arr, item, target_type, b: Bin):
    a = np.asarray(arr, dtype=np.float64)
    n = len(a)
    if target_type in ("Uint8Array", "Uint16Array", "Uint32Array", "Int8Array", "Int16Array", "Int32Array"):
        # integer attribute (skinIndex) -> stored raw in its own type
        dt = {"Uint8Array": np.uint8, "Uint16Array": np.uint16, "Uint32Array": np.uint32,
              "Int8Array": np.int8, "Int16Array": np.int16, "Int32Array": np.int32}[target_type]
        q = a.astype(dt)
        return {"o": b.add(q), "n": n, "q": np.dtype(dt).name}
    if name == "normal":
        q = np.clip(np.round(a * 127.0), -127, 127).astype(np.int8)
        return {"o": b.add(q), "n": n, "q": "i8n"}
    if name == "skinWeight":
        q = np.clip(np.round(a * 255.0), 0, 255).astype(np.uint8)
        return {"o": b.add(q), "n": n, "q": "u8w", "k": item}
    # generic float attribute -> uint16 with per-component range
    a2 = a.reshape(-1, item)
    mn = a2.min(axis=0)
    mx = a2.max(axis=0)
    rng = np.where(mx - mn > 0, mx - mn, 1.0)
    step = rng / 65535.0
    q = np.clip(np.round((a2 - mn) / step), 0, 65535).astype(np.uint16).reshape(-1)
    return {"o": b.add(q), "n": n, "q": "u16r", "k": item,
            "min": [float(x) for x in mn], "step": [float(x) for x in step]}


def reduce_track(times, values, stride, kind):
    """Greedy removal of keys that linear interpolation reproduces within tolerance."""
    t = np.asarray(times, dtype=np.float64)
    v = np.asarray(values, dtype=np.float64).reshape(len(t), stride)
    if len(t) <= 2:
        return t, v
    span = np.ptp(v, axis=0).max()
    tol = 4e-4 if kind == "quaternion" else max(1e-5, span * 2e-3)
    keep = [0]
    i = 0
    while i < len(t) - 1:
        j = i + 2
        # extend the segment while all intermediate keys are within tolerance
        while j < len(t):
            seg_t = t[i + 1:j]
            w = ((seg_t - t[i]) / (t[j] - t[i]))[:, None]
            interp = v[i] * (1 - w) + v[j] * w
            if np.abs(interp - v[i + 1:j]).max() > tol:
                break
            j += 1
        nxt = j - 1
        keep.append(nxt)
        i = nxt
    keep = sorted(set(keep))
    return t[keep], v[keep]


def encode_image(img_bytes: bytes, name: str, uuid: str, cap: int | None):
    im = Image.open(io.BytesIO(img_bytes))
    im.load()
    has_alpha = im.mode in ("RGBA", "LA") and np.array(im)[..., -1].min() < 250
    if cap and max(im.size) > cap:
        im = im.resize((cap, cap), Image.LANCZOS)
    out = io.BytesIO()
    if has_alpha:
        im.convert("RGBA").save(out, "WEBP", quality=90, method=6)
        ext = "webp"
    else:
        im.convert("RGB").save(out, "JPEG", quality=90, optimize=True, progressive=True, subsampling=0)
        ext = "jpg"
    safe = "".join(c if c.isalnum() else "_" for c in name)[:32].strip("_") or "tex"
    return f"tex/{safe}_{uuid[:6]}.{ext}", out.getvalue(), im.size


def build():
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)
    # --- player files
    shutil.copy2(ORIG / "index.css", DIST / "index.css")
    # the cube's camera pans with the right button (and two fingers), like a GLB viewer:
    # the player turns panning off in its cube mode; turn it back on in our copy
    js = (ORIG / "index.js").read_text(encoding="utf-8")
    pan_off = "this.orbitControls.enabled=!0,this.orbitControls.enablePan=!1,"
    assert js.count(pan_off) == 1, "player changed: cube OrbitControls setup not found"
    js = js.replace(pan_off, "this.orbitControls.enabled=!0,this.orbitControls.enablePan=!0,")
    # load the content while "Tap to start" waits, not after the tap
    load_on_tap = "update(e,t){if(this.state===fc){"
    assert js.count(load_on_tap) == 1, "player changed: content loader state not found"
    js = js.replace(load_on_tap, "update(e,t){this.contentLoadFunc&&(this.contentLoadFunc(),"
                    "this.contentLoadFunc=null,this.state=fc);if(this.state===fc){")
    # three r151 asks every new shader program for its uniforms the moment it is created, which waits
    # for the driver to finish compiling it: one shader after another, the page frozen meanwhile.
    # Ask on first use instead, so renderer.compile() only queues the shaders; the driver compiles
    # them in parallel (KHR_parallel_shader_compile) while the content waits for them.
    eager = "const it=je.getUniforms(),Vt=qo.seqWithValue(it.seq,Ye);return F.currentProgram=je,F.uniformsList=Vt,je}"
    assert js.count(eager) == 1, "player changed: three's getProgram not found"
    js = js.replace(eager, "let Vt=null;Object.defineProperty(F,\"uniformsList\",{configurable:!0,enumerable:!0,"
                    "get(){return Vt||(Vt=qo.seqWithValue(je.getUniforms().seq,Ye))},set(it){Vt=it}});"
                    "return F.currentProgram=je,je}")
    (DIST / "index.js").write_text(js, encoding="utf-8")
    html = (ORIG / "index.html").read_text(encoding="utf-8")
    # no XR button (nor its popups): the piece is seen on screen only
    html = html.replace("</head>", "  <style>.ejx-LaunchRoot,.ejx-LaunchButtonWrapper,.ejx-LaunchButton,"
                        ".ejx-LauncherPopup{display:none!important}</style>\n</head>", 1)
    assert "ejx-LaunchRoot" in html
    html = html.replace("<title>EJX :: Player</title>", "<title>Truman Show · EJX Cube</title>")
    meta = "\n".join([
        '    <meta name="description" content="Good morning, and in case I don&#39;t see ya: '
        'good afternoon, good evening and good night. An EyeJack X cube." />',
        '    <meta property="og:title" content="Truman Show · EJX Cube" />',
        '    <meta property="og:image" content="cover.jpg" />',
    ]) + "\n"
    anchor = '    <meta charset="utf-8" />\n'
    html = html.replace(anchor, anchor + meta, 1)
    (DIST / "index.html").write_text(html, encoding="utf-8")
    cover = ROOT / "captures" / "cover.jpg"
    if cover.exists():
        shutil.copy2(cover, DIST / "cover.jpg")
    else:
        print("  (no captures/cover.jpg yet: og:image will be missing)")
    for d in ["fonts", "icons", "images"]:
        shutil.copytree(ORIG / d, DIST / d)
    (DIST / "content" / "tex").mkdir(parents=True)

    data = json.loads((ORIG / "content" / "app.json").read_text(encoding="utf-8"))
    scene = data["scene"]
    b = Bin()

    # --- remove objects
    removed_geo = set()
    removed_mat = set()

    def prune(obj):
        kids = []
        for c in obj.get("children", []):
            if c.get("name") in REMOVE_OBJECTS:
                if "geometry" in c:
                    removed_geo.add(c["geometry"])
                if isinstance(c.get("material"), str):
                    removed_mat.add(c["material"])
                print("  removed object", c.get("name"))
                continue
            prune(c)
            kids.append(c)
        if "children" in obj:
            obj["children"] = kids

    prune(scene["object"])

    # material ids still referenced
    used_mats = set()

    def collect(obj):
        m = obj.get("material")
        if isinstance(m, str):
            used_mats.add(m)
        elif isinstance(m, list):
            used_mats.update(m)
        for c in obj.get("children", []):
            collect(c)

    collect(scene["object"])
    used_geo, used_anim = set(), set()

    def collect_refs(obj):
        if "geometry" in obj:
            used_geo.add(obj["geometry"])
        used_anim.update(obj.get("animations", []))
        for c in obj.get("children", []):
            collect_refs(c)

    collect_refs(scene["object"])
    scene["geometries"] = [g for g in scene["geometries"] if g["uuid"] in used_geo]
    scene["materials"] = [m for m in scene["materials"] if m["uuid"] in used_mats]
    scene["animations"] = [a for a in scene["animations"] if a["uuid"] in used_anim]

    # --- textures / images
    tex_by_uuid = {t["uuid"]: t for t in scene["textures"]}
    drop_tex = {t["uuid"] for t in scene["textures"] if t.get("name") in DROP_TEXTURE_NAMES}
    for m in scene["materials"]:
        for k, v in list(m.items()):
            if isinstance(v, str) and v in drop_tex:
                del m[k]
    used_tex = set()
    for m in scene["materials"]:
        for k, v in m.items():
            if isinstance(v, str) and v in tex_by_uuid:
                used_tex.add(v)
    scene["textures"] = [t for t in scene["textures"] if t["uuid"] in used_tex]
    used_imgs = {t["image"] for t in scene["textures"]}
    headphone_imgs = set()
    for m in scene["materials"]:
        if m.get("name") == "Scene_-_Root.001":
            for k, v in m.items():
                if isinstance(v, str) and v in tex_by_uuid:
                    headphone_imgs.add(tex_by_uuid[v]["image"])
    img_name = {t["image"]: t.get("name", "tex") for t in scene["textures"]}
    new_images = []
    tex_bytes = 0
    for im in scene["images"]:
        if im["uuid"] not in used_imgs:
            continue
        raw = base64.b64decode(im["url"].split(",", 1)[1])
        cap = HEADPHONE_IMAGES_MAX if im["uuid"] in headphone_imgs else MAX_SIZE.get(img_name.get(im["uuid"]), None)
        rel, enc, size = encode_image(raw, img_name.get(im["uuid"], "tex"), im["uuid"], cap)
        (DIST / "content" / rel).write_bytes(enc)
        tex_bytes += len(enc)
        print(f"  image {rel:48s} {size[0]}x{size[1]}  {len(raw)//1024:5d} KB -> {len(enc)//1024:4d} KB")
        new_images.append({"uuid": im["uuid"], "url": rel})
    scene["images"] = new_images

    # --- geometries -> bin
    for g in scene["geometries"]:
        gd = g.get("data")
        if not gd:
            continue
        attrs = gd["attributes"]
        for drop in ("uv2", "texcoord_2"):
            attrs.pop(drop, None)
        for name, a in attrs.items():
            desc = quantize_attr(name, a["array"], a["itemSize"], a["type"], b)
            del a["array"]
            a["bin"] = desc
        idx = gd.get("index")
        if idx:
            arr = np.asarray(idx["array"])
            dt = np.uint32 if arr.max() > 65535 else np.uint16
            idx["type"] = "Uint32Array" if dt == np.uint32 else "Uint16Array"
            idx["bin"] = {"o": b.add(arr.astype(dt)), "n": len(arr), "q": np.dtype(dt).name}
            del idx["array"]

    # --- animations -> bin
    for an in scene["animations"]:
        before = after = 0
        for t in an["tracks"]:
            n = len(t["times"])
            stride = len(t["values"]) // max(n, 1)
            before += n
            v = np.asarray(t["values"], dtype=np.float64).reshape(n, stride)
            if n > 1 and np.allclose(v, v[0], atol=1e-5):
                t["times"] = [0]
                t["values"] = [float(x) for x in v[0]]
                after += 1
                continue
            tt, vv = reduce_track(t["times"], t["values"], stride, t["type"])
            after += len(tt)
            t["times_bin"] = {"o": b.add(tt.astype(np.float32)), "n": len(tt), "q": "float32"}
            if t["type"] == "quaternion":
                q = np.clip(np.round(vv.reshape(-1) * 32767), -32767, 32767).astype(np.int16)
                t["values_bin"] = {"o": b.add(q), "n": q.size, "q": "i16n"}
            else:
                t["values_bin"] = {"o": b.add(vv.reshape(-1).astype(np.float32)), "n": vv.size, "q": "float32"}
            del t["times"]
            del t["values"]
        print(f"  animation {an.get('name') or an['uuid'][:8]}: {before} keys -> {after} keys")

    scripts = data.get("scripts", {})
    # the per-object EJX mixer scripts are replaced by the runtime timeline
    data["scripts"] = {}
    data["legacyScripts"] = list(scripts.keys())

    app_json = json.dumps(data, separators=(",", ":"))
    (DIST / "content" / "app.json").write_text(app_json, encoding="utf-8")
    (DIST / "content" / "scene.bin").write_bytes(bytes(b.buf))

    # --- runtime sources
    src_content = SRC / "content"
    for p in src_content.rglob("*"):
        if p.is_file():
            dst = DIST / "content" / p.relative_to(src_content)
            dst.parent.mkdir(parents=True, exist_ok=True)
            if p.name == "sky_wall.jpg":        # the painted sky: WebP, a third of the size
                Image.open(p).save(dst.with_suffix(".webp"), "WEBP", quality=86, method=6)
            elif p.name == "text_atlas.png":    # the text masks (R crisp, G soft): lossless WebP
                Image.open(p).save(dst.with_suffix(".webp"), "WEBP", lossless=True, quality=100, method=6)
            else:
                shutil.copy2(p, dst)
    for p in SRC.glob("*"):
        if p.is_file():
            shutil.copy2(p, DIST / p.name)

    ejx = json.loads((ORIG / "content" / "ejx.json").read_text(encoding="utf-8"))
    ejx["app-json-length"] = len(app_json.encode("utf-8"))
    ejx["scene-bin-length"] = len(b.buf)
    (DIST / "content" / "ejx.json").write_text(json.dumps(ejx, indent="\t"), encoding="utf-8")

    # the player first: it puts the cube and "Tap to start" on screen. Its font is preloaded at once,
    # the content's files as soon as the player script has run (preloaded along with it, they took
    # its bandwidth and the page stayed black for seconds on a slow line)
    font = '<link rel="preload" href="./fonts/URWDIN-Demi.ttf" as="font" type="font/ttf" crossorigin>'
    later = [["preload", "./content/scene.bin", "fetch"], ["preload", "./content/app.json", "fetch"],
             ["modulepreload", "./content/app.js", ""]]
    later += [["modulepreload", f"./content/lib/{p.name}", ""] for p in sorted((DIST / "content" / "lib").glob("*.js"))]
    big = sorted((DIST / "content" / "tex").glob("*"), key=lambda p: -p.stat().st_size)
    later += [["preload", f"./content/tex/{p.name}", "image"] for p in big
              if p.suffix in (".jpg", ".webp", ".png") and p.stat().st_size > 60000]
    script = ("<script>addEventListener('DOMContentLoaded',function(){" + json.dumps(later, separators=(",", ":")) +
              ".forEach(function(l){var e=document.createElement('link');e.rel=l[0];e.href=l[1];"
              "if(l[2]){e.as=l[2];e.crossOrigin='anonymous'}document.head.appendChild(e)})})</script>")
    page = (DIST / "index.html").read_text(encoding="utf-8")
    tag = '  <script type="module" crossorigin src="./index.js"></script>'
    assert page.count(tag) == 1
    page = page.replace(tag, "  " + font + "\n" + tag + "\n  " + script, 1)
    # the loading bar is on screen from the first instant (content/app.js takes it over): white on a
    # dark glass, readable over the black page and over the player's white loading cube alike
    page = page.replace("</head>", "  <style>" + LOADING_CSS + "</style>\n</head>", 1)
    page = page.replace("</body>", '    <div id="truman-loading" class="wait"><div class="tl-label">Loading Seahaven</div>'
                        '<div class="tl-track"><div class="tl-fill"></div></div></div>\n</body>', 1)
    assert page.count('id="truman-loading"') == 1 and LOADING_CSS in page
    (DIST / "index.html").write_text(page, encoding="utf-8")

    build_ar()

    total = sum(p.stat().st_size for p in DIST.rglob("*") if p.is_file())
    print(f"app.json {len(app_json)//1024} KB | scene.bin {len(b.buf)//1024} KB | textures {tex_bytes//1024} KB")
    print(f"dist total {total/1024/1024:.2f} MB")


def build_ar():
    """ar/: amAr's viewer for this cube (tools/import_ar.py brings it into src/ar/). It reads the cube from the same
    content/ as the EyeJack player; here it gets the list of those files and their sizes (for its loading bar)."""
    src = SRC / "ar"
    if not (src / "proyecto.json").exists():
        print("no src/ar/ (python tools/import_ar.py): this build has no AR view")
        return
    dst = DIST / "ar"
    shutil.copytree(src, dst)
    content = DIST / "content"
    # not for the AR view: the EyeJack player's app and the cube page's own AR button
    skip = {"app.js", "lib/arbutton.js", "lib/qrcode.js"}
    files = sorted(f for f in (p.relative_to(content).as_posix() for p in content.rglob("*") if p.is_file()) if f not in skip)
    page = (dst / "index.html").read_text(encoding="utf-8")
    assert page.count("<title>amAr</title>") == 1
    page = page.replace("<title>amAr</title>", '<title>amAr</title>' + chr(10) + '<link rel="icon" type="image/svg" href="../icons/favicon.svg">', 1)
    (dst / "index.html").write_text(page, encoding="utf-8")
    proj = json.loads((dst / "proyecto.json").read_text(encoding="utf-8"))
    sizes = {}
    for scene in proj["escenas"]:
        for c in scene.get("contenidos", []):
            if c.get("tipo") == "cubo":
                c["archivos"] = files
                for f in files:
                    n = (content / f).stat().st_size
                    sizes[c["carpeta"] + f] = {"bytes": n, "aire": n}
    (dst / "proyecto.json").write_text(json.dumps(proj, ensure_ascii=False, indent=2) + chr(10), encoding="utf-8")
    (dst / "pesos.json").write_text(json.dumps(sizes, separators=(",", ":")), encoding="utf-8")
    kb = sum(p.stat().st_size for p in dst.rglob("*") if p.is_file()) / 1024
    print(f"ar/ {kb:.0f} KB (amAr {proj.get('exportado', {}).get('commit', '?')}), reading {len(files)} files of content/")


def make_zip():
    out = ROOT / "trumanshow_objkt.zip"
    if out.exists():
        out.unlink()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for p in sorted(DIST.rglob("*")):
            if p.is_file():
                z.write(p, p.relative_to(DIST).as_posix())
    print(f"zip -> {out.name} {out.stat().st_size/1024/1024:.2f} MB")


def make_pages():
    """mirror dist/ into docs/, the folder GitHub Pages serves"""
    docs = ROOT / "docs"
    if docs.exists():
        shutil.rmtree(docs)
    shutil.copytree(DIST, docs)
    (docs / ".nojekyll").write_text("", encoding="utf-8")      # serve every file as it is
    # objkt.html: the piece in a frame like objkt's (same sandbox and permissions), to try the AR button on a phone
    # before minting. Only on the site, not in the zip
    (docs / "objkt.html").write_text(
        '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>Prueba: el cubo como en objkt</title><style>html,body{margin:0;height:100%;background:#0b0c0e}'
        'iframe{position:fixed;inset:0;width:100%;height:100%;border:0}</style></head><body>'
        '<iframe src="./index.html?creators=prueba&amp;objkt=0" sandbox="allow-scripts allow-downloads" '
        'allow="accelerometer; camera; gyroscope; microphone; xr-spatial-tracking; midi;"></iframe></body></html>' + chr(10),
        encoding="utf-8")
    print(f"pages -> {docs.relative_to(ROOT)}/")


if __name__ == "__main__":
    build()
    if "--zip" in sys.argv:
        make_zip()
    if "--pages" in sys.argv:
        make_pages()
