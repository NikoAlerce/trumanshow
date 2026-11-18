"""
Generates the painted dome sky used by the sky wall, its extension, the far dome
and the water reflections:  src/content/tex/sky_wall.jpg

The texture tiles horizontally.  Bottom edge = horizon / waterline.
Clouds get smaller and flatter towards the horizon (painted perspective),
like the Seahaven dome backdrop.

python tools/gen_sky.py [--preview]
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "content" / "tex" / "sky_wall.jpg"

W, H = 3072, 2048
rng = np.random.default_rng(1998)  # the year of the film


def periodic_noise(h, w, beta, seed):
    """Tileable fractal noise via spectral synthesis (1/f^beta)."""
    r = np.random.default_rng(seed)
    white = r.standard_normal((h, w))
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    f = np.sqrt(fx * fx + fy * fy)
    f[0, 0] = 1.0
    spec = np.fft.fft2(white) / (f ** beta)
    spec[0, 0] = 0
    n = np.real(np.fft.ifft2(spec))
    n -= n.mean()
    n /= n.std()
    return n.astype(np.float32)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def gaussian_blur(a, sigma):
    if sigma < 0.5:
        return a
    return ndimage.gaussian_filter(a.astype(np.float32), sigma, mode="nearest")


# ---------------------------------------------------------------- sky gradient
yy = np.linspace(0.0, 1.0, H, dtype=np.float32)[:, None]   # 0 top .. 1 horizon
elev = 1.0 - yy                                             # 0 horizon .. 1 top
zenith = np.array([0.20, 0.45, 0.80], np.float32)
mid = np.array([0.36, 0.60, 0.88], np.float32)
horizon = np.array([0.74, 0.85, 0.94], np.float32)
t1 = smoothstep(0.0, 0.55, elev)[..., None]
t2 = smoothstep(0.35, 1.0, elev)[..., None]
sky = horizon * (1 - t1) + mid * t1
sky = sky * (1 - t2) + zenith * t2
sky = np.broadcast_to(sky, (H, W, 3)).copy()

# large scale painted variation of the blue
var = periodic_noise(H, W, 2.2, 11)
sky *= (1.0 + 0.035 * var)[..., None]

# ---------------------------------------------------------------- clouds
detail = 0.65 * periodic_noise(H, W, 1.9, 21) + 0.35 * periodic_noise(H, W, 1.45, 22)  # billowy edge detail
detail2 = periodic_noise(H, W, 1.5, 31)
coverage_color = sky.copy()

light = np.array([0.45, -1.0], np.float32)   # (x, y) image space, light from upper right
light /= np.linalg.norm(light)


def cloud_scale(e):
    # e: 0 horizon .. 1 top of texture ; returns width in px (painted perspective)
    return 110 + 640 * (e ** 1.1)


def flatness(e):
    return 0.30 + 0.20 * min(1.0, e * 1.3)


def wrapdx(a, b):
    d = abs(a - b) % W
    return min(d, W - d)


clouds = []
attempts = 0
while attempts < 20000 and len(clouds) < 64:
    attempts += 1
    e = rng.uniform(0.0, 1.0) ** 1.25 * 1.04 + 0.012
    width = cloud_scale(e) * rng.uniform(0.75, 1.45)
    height = width * flatness(e)
    x = rng.uniform(0, W)
    cy = (1 - e) * H - height * 0.5
    ok = True
    for (xx, ee, ww, hh) in clouds:
        cyy = (1 - ee) * H - hh * 0.5
        dx = wrapdx(x, xx) / ((width + ww) * 0.5 * 1.05)
        dy = (cy - cyy) / ((height + hh) * 0.5 * 1.25)
        if dx * dx + dy * dy < 1.0:
            ok = False
            break
    if ok:
        clouds.append((x, e, width, height))

clouds.sort(key=lambda c: c[1])
print("clouds:", len(clouds))

for (cx, ce, width, height) in clouds:
    base_y = (1.0 - ce) * H                    # flat bottom line (image px)
    pad = int(width * 0.30)
    x0 = int(cx - width / 2 - pad)
    x1 = int(cx + width / 2 + pad)
    y0 = int(base_y - height * 1.25 - pad)
    y1 = int(base_y + pad * 0.3)
    if y1 <= 0 or y0 >= H:
        continue
    y0c, y1c = max(0, y0), min(H, y1)
    px = np.arange(x0, x1)[None, :].astype(np.float32)
    py = np.arange(y0c, y1c)[:, None].astype(np.float32)
    dens = np.zeros((y1c - y0c, x1 - x0), np.float32)
    # 2-4 towers (lobes) of different heights, each made of puffs
    ntower = int(rng.integers(2, 5))
    towers = []
    for k in range(ntower):
        tu = (k + rng.uniform(0.2, 0.8)) / ntower * 2 - 1
        th = (1 - 0.55 * abs(tu)) * rng.uniform(0.6, 1.05)
        towers.append((tu, th))
    # base layer: wide flat puffs
    nbase = int(5 + width / 45)
    for _ in range(nbase):
        u = rng.uniform(-1, 1)
        pr = width * rng.uniform(0.13, 0.19) * (1 - 0.35 * abs(u))
        pcx = cx + u * width * 0.40
        pcy = base_y - pr * 0.62
        d2 = ((px - pcx) ** 2 + ((py - pcy) * 1.25) ** 2) / (pr * pr)
        dens += np.clip(1 - d2, 0, 1) ** 1.4
    # solid core so the body has no holes
    d2 = ((px - cx) ** 2 / (width * 0.36) ** 2 + (py - (base_y - height * 0.32)) ** 2 / (height * 0.36) ** 2)
    dens += 0.9 * np.clip(1 - d2, 0, 1) ** 1.2
    # towers
    for (tu, th) in towers:
        npuff = int(6 + width / 45)
        for _ in range(npuff):
            vv = rng.uniform(0, 1) ** 0.8
            pr = width * rng.uniform(0.10, 0.17) * (1.1 - 0.45 * vv)
            pcx = cx + tu * width * 0.30 + rng.normal(0, width * 0.06) * (1 - 0.5 * vv)
            pcy = base_y - pr * 0.7 - vv * height * th
            d2 = ((px - pcx) ** 2 + (py - pcy) ** 2) / (pr * pr)
            dens += np.clip(1 - d2, 0, 1) ** 1.5
    dens = gaussian_blur(dens, max(0.8, width * 0.012))
    # flat (slightly wavy) bottom
    soft = 2.5 + width * 0.03
    wav = 0.04 * height * np.sin(px / width * 9.0 + cx)
    dens *= smoothstep(base_y + wav + soft * 0.4, base_y + wav - soft, py)
    # soft billowy detail from the tileable noise (wrapped in x)
    xi = (np.arange(x0, x1) % W)
    det = detail[y0c:y1c][:, xi]
    det2 = detail2[y0c:y1c][:, xi]
    dd = dens + 0.14 * det * np.clip(dens * 2.5, 0, 1)
    alpha = smoothstep(0.16, 0.50, dd)
    if alpha.max() < 0.05:
        continue
    # shading from the density gradient (lobes catch the light on their tops)
    blur = gaussian_blur(dens, max(1.0, width * 0.022)) + 0.04 * det
    gy, gx = np.gradient(blur)
    gmag = np.sqrt(gx * gx + gy * gy) + 1e-6
    nx, ny = -gx / gmag, -gy / gmag
    edge = np.clip(gmag / (np.percentile(gmag, 92) + 1e-6), 0, 1) ** 0.7
    lam = (nx * light[0] + ny * light[1]) * edge
    top_y = base_y - height * 1.1
    rel = np.clip((py - top_y) / max(base_y - top_y, 1), 0, 1)   # 0 top .. 1 base
    shade = 0.70 + 0.36 * lam - 0.48 * smoothstep(0.50, 1.0, rel) + 0.05 * det2
    shade = np.clip(shade, 0, 1.05)
    lit = np.array([1.0, 0.99, 0.965], np.float32)
    shadow = np.array([0.56, 0.65, 0.79], np.float32)
    col = shadow + (lit - shadow) * shade[..., None]
    # aerial perspective near the horizon
    aerial = (1 - smoothstep(0.0, 0.40, ce)) * 0.42
    hz = sky[y0c:y1c][:, xi]
    col = col * (1 - aerial) + hz * aerial
    a = alpha * (1 - 0.2 * (1 - smoothstep(0.0, 0.2, ce)))
    region = coverage_color[y0c:y1c][:, xi]
    region = region * (1 - a[..., None]) + col * a[..., None]
    coverage_color[y0c:y1c, :][:, xi] = region

img = coverage_color

# ---------------------------------------------------------------- paint finish
# soft brush streaks (anisotropic noise stretched horizontally)
streak = periodic_noise(H, W // 8, 1.0, 41)
streak = ndimage.zoom(streak, (1, 8), order=3, mode="grid-wrap")[:H, :W].astype(np.float32)
img *= (1 + 0.018 * streak)[..., None]
# canvas grain
grain = periodic_noise(H, W, 0.15, 51)
img += 0.010 * grain[..., None]
# gentle overall softness (painted, not photographic)
img = np.clip(img, 0, 1)
out = Image.fromarray((img * 255 + 0.5).astype(np.uint8), "RGB")
out = out.filter(ImageFilter.GaussianBlur(0.6))
OUT.parent.mkdir(parents=True, exist_ok=True)
out.save(OUT, "JPEG", quality=88, optimize=True, progressive=True)
print("wrote", OUT, OUT.stat().st_size // 1024, "KB")
if "--preview" in sys.argv:
    prev = ROOT.parent / "sky_preview.jpg"
    out.resize((W // 3, H // 3), Image.LANCZOS).save(sys.argv[sys.argv.index("--preview") + 1] if len(sys.argv) > sys.argv.index("--preview") + 1 else prev)
