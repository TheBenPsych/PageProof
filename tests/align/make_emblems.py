"""Different photos that share only a seal, a crest or a repeating pattern: the checker must NOT
call these copies. Run by make_test_copies.py (adds to its manifest). Made-up scenes only.

1. Podium seal: someone speaks behind a podium with a round gold seal on the front. Another
   photographer, another moment: a closer shot of the podium, someone else behind it.
2. Wall crest: a big seal on the curtain behind the speaker; another shot with someone else
   standing in a different place and the camera zoomed differently.
3. Chain-link fence and a checkered floor: the same pattern, different things in front.
Real copies of each scene (a thumbnail, a crop) must still be found."""
import math, os, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'

def seal(R=300, seed=5):
    """A made-up round gold seal: rings, lettering round the edge, a shield, stars, embossed noise."""
    rng = random.Random(seed); S = 2 * R
    yy, xx = np.mgrid[0:S, 0:S].astype(float); r = np.hypot(xx - R, yy - R) / R
    # embossed gold: light from the top left
    n = np.random.default_rng(seed).normal(0, 1, (S // 6, S // 6))
    n = np.array(Image.fromarray(((n - n.min()) / np.ptp(n) * 255).astype('uint8')).resize((S, S), Image.BICUBIC)).astype(float) / 255
    g = 150 + 60 * n - 40 * ((xx + yy) / S - 1)
    im = Image.fromarray(np.stack([np.clip(g * 1.0, 0, 255), np.clip(g * 0.8, 0, 255), np.clip(g * 0.42, 0, 255)], -1).astype('uint8'))
    d = ImageDraw.Draw(im)
    for rr, w in [(0.98, 10), (0.80, 6), (0.74, 3)]: d.ellipse((R - rr * R, R - rr * R, R + rr * R, R + rr * R), outline=(95, 70, 25), width=w)
    f = ImageFont.truetype(FONT, int(R * 0.12)) if os.path.exists(FONT) else ImageFont.load_default()
    words = 'GREAT SEAL OF THE MADE UP STATE * EXCELSIOR * '
    for i, ch in enumerate(words):
        a = -math.pi * 0.95 + i * 2 * math.pi / len(words)
        x, y = R + 0.87 * R * math.cos(a), R + 0.87 * R * math.sin(a)
        t = Image.new('L', (int(R * 0.16), int(R * 0.16)), 0); ImageDraw.Draw(t).text((2, 0), ch, font=f, fill=255)
        t = t.rotate(-math.degrees(a) - 90, Image.BICUBIC)
        im.paste((90, 64, 20), (int(x - t.width / 2), int(y - t.height / 2)), t)
    # shield with an eagle-ish shape, two figures, stars
    d.polygon([(R - 0.3 * R, R - 0.35 * R), (R + 0.3 * R, R - 0.35 * R), (R + 0.28 * R, R + 0.15 * R), (R, R + 0.45 * R), (R - 0.28 * R, R + 0.15 * R)], fill=(120, 90, 35), outline=(70, 50, 15))
    for k in range(9):
        a = math.pi * (0.15 + 0.7 * k / 8); x, y = R + 0.55 * R * math.cos(a + math.pi), R - 0.1 * R + 0.55 * R * math.sin(a + math.pi)
        d.regular_polygon((x, y, R * 0.04), 5, fill=(230, 200, 120))
    for sx in (-1, 1):
        x = R + sx * 0.5 * R; d.ellipse((x - 0.06 * R, R - 0.25 * R, x + 0.06 * R, R - 0.13 * R), fill=(200, 160, 80))
        d.polygon([(x - 0.1 * R, R + 0.4 * R), (x + 0.1 * R, R + 0.4 * R), (x + 0.05 * R, R - 0.12 * R), (x - 0.05 * R, R - 0.12 * R)], fill=(190, 150, 70))
    for i in range(40):   # random rivets / engraving, so the seal is one of a kind
        x, y = rng.uniform(0.25, 1.75) * R, rng.uniform(0.25, 1.75) * R
        if math.hypot(x - R, y - R) < 0.7 * R: d.line((x, y, x + rng.uniform(-12, 12), y + rng.uniform(-12, 12)), fill=(85, 60, 20), width=2)
    m = Image.fromarray((r < 1).astype('uint8') * 255)
    return im, m

def person(src, size, seed):
    """Something in front: another photo (a different subject each time), cut out in an oval."""
    p = src.resize(size, Image.LANCZOS)
    mk = Image.new('L', size, 0); ImageDraw.Draw(mk).ellipse((0, 0, size[0], size[1] * 1.6), fill=255)
    return p, mk.filter(ImageFilter.GaussianBlur(5))

def crowd(W, H, seed):
    rng = random.Random(seed); im = Image.new('RGB', (W, H), (25, 28, 36)); d = ImageDraw.Draw(im)
    for _ in range(int(W * H / 2500)):
        x, y = rng.randint(0, W), rng.randint(0, H); c = tuple(rng.randint(20, 120) for _ in range(3))
        d.ellipse((x, y, x + 26, y + 30), fill=(rng.randint(150, 220), rng.randint(110, 170), rng.randint(90, 140))); d.rectangle((x - 8, y + 28, x + 34, y + 80), fill=c)
    return im

def podium_scene(SL, who, W, H, seal_box, pod_box, seed, bg=None):
    im = bg.copy() if bg is not None else crowd(W, H, seed)
    p, mk = person(who, (int((pod_box[2] - pod_box[0]) * 0.8), int((pod_box[1]) * 0.75)), seed)
    im.paste(p, (int(pod_box[0] + (pod_box[2] - pod_box[0]) * 0.1), pod_box[1] - p.height + 20), mk)
    d = ImageDraw.Draw(im); d.polygon([(pod_box[0], pod_box[1]), (pod_box[2], pod_box[1]), (pod_box[2] - 15, pod_box[3]), (pod_box[0] + 15, pod_box[3])], fill=(28, 34, 62))
    s, m = SL; s2 = s.resize((seal_box[2] - seal_box[0], seal_box[3] - seal_box[1]), Image.LANCZOS); m2 = m.resize(s2.size, Image.LANCZOS)
    im.paste(s2, seal_box[:2], m2)
    return im

def fence(W, H, cell, ang, seed):
    """Chain-link: a diamond wire grid (alpha mask) the same everywhere."""
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    u, v = (xx * math.cos(ang) + yy * math.sin(ang)) / cell, (-xx * math.sin(ang) + yy * math.cos(ang)) / cell
    du, dv = np.abs(u - np.round(u)), np.abs(v - np.round(v))
    return (np.clip(1.6 - np.minimum(du, dv) * cell / 1.4, 0, 1) * 255).astype('uint8')

def checker(W, H, horizon, sq, seed):
    """A checkered floor in perspective, black and white tiles."""
    yy, xx = np.mgrid[0:H, 0:W].astype(float); z = np.maximum(yy - horizon, 1)
    X, Z = (xx - W / 2) / z / 0.25 * sq, 600 / z / 2.5 * sq
    v = ((np.floor(X) + np.floor(Z)) % 2) * 200 + 30
    a = np.where(yy > horizon, v, 0)
    return a

def add_cases(OUT, D, manifest, make, S, T, jpeg):
    src = {n: Image.open(os.path.join(D, n)).convert('RGB') for n in ['astronaut.png', 'chelsea.png', 'coffee.png', 'rocket.jpg', 'immunohistochemistry.png'] if os.path.exists(os.path.join(D, n))}
    SL = seal()
    # 1. podium seal: original 400 x 600 (portrait, like a news agency photo), seal small on the podium
    A = podium_scene(SL, src['astronaut.png'], 400, 600, (130, 430, 190, 490), (90, 400, 260, 560), 1)
    A.save(f'{OUT}/podium.png')
    # another photographer: tight on the podium, the seal big, someone else behind it, other room
    B = podium_scene(SL, src['chelsea.png'], 1200, 800, (470, 430, 730, 690), (300, 330, 900, 800), 2)
    B = ImageEnhance.Brightness(B.rotate(1.5, Image.BICUBIC)).enhance(1.08); B.save(f'{OUT}/podium-other-shot.png'); manifest.append({'orig': 'podium.png', 'copy': 'podium-other-shot.png', 'G': None})
    jpeg(B.resize((300, 200), Image.LANCZOS), 70).save(f'{OUT}/podium-other-shot-tiny.png'); manifest.append({'orig': 'podium.png', 'copy': 'podium-other-shot-tiny.png', 'G': None})
    img, G = make(A, S(1.5) @ T(-40, -250), (420, 380)); jpeg(img, 80).save(f'{OUT}/podium__real-crop.png')
    manifest.append({'orig': 'podium.png', 'copy': 'podium__real-crop.png', 'G': G[:2].tolist()})
    # 2. a big crest on the wall behind the speaker (left part of the frame); other shot: zoomed, the
    #    speaker somewhere else, so only the crest is shared
    def relit(im, seed):
        # another camera, other lights: brighter on one side, softer, its own sensor noise
        a = np.asarray(im).astype(float); h, w = a.shape[:2]; g = np.linspace(0.8, 1.2, w)[None, :, None]
        rng = np.random.default_rng(seed)   # shiny metal: blotchy reflections that move with the lights
        b = rng.normal(0, 1, (h // 12 + 2, w // 12 + 2)); b = np.array(Image.fromarray(((b - b.min()) / np.ptp(b) * 255).astype('uint8')).resize((w, h), Image.BICUBIC)).astype(float) / 255
        a = a * g * (0.6 + 0.8 * b)[:, :, None] + rng.normal(0, 6, a.shape)
        return Image.fromarray(np.clip(a, 0, 255).astype('uint8')).filter(ImageFilter.GaussianBlur(1.2))
    def wall_scene(who, W, H, seal_box, pbox, seed, light=False):
        bg = Image.new('RGB', (W, H), (18, 22, 48)); d = ImageDraw.Draw(bg)
        for x in range(0, W, max(6, W // 60)): d.line((x, 0, x, H), fill=(26, 30, 60), width=3)   # curtain folds
        s, m = SL; s2 = s.resize((seal_box[2] - seal_box[0],) * 2, Image.LANCZOS)
        if light: s2 = relit(s2, seed)
        bg.paste(s2, seal_box[:2], m.resize(s2.size))
        p, mk = person(who, (pbox[2] - pbox[0], pbox[3] - pbox[1]), seed); bg.paste(p, pbox[:2], mk); return bg
    A = wall_scene(src['coffee.png'], 800, 533, (-150, -60, 330, 420), (380, 60, 760, 533), 3); A.save(f'{OUT}/crest.png')
    B = wall_scene(src['rocket.jpg'], 1600, 1066, (600, -20, 1380, 760), (80, 150, 650, 1066), 4, light=True)
    B.save(f'{OUT}/crest-other-shot.png'); manifest.append({'orig': 'crest.png', 'copy': 'crest-other-shot.png', 'G': None})
    jpeg(B.resize((403, 268), Image.LANCZOS), 70).save(f'{OUT}/crest-other-shot-tiny.png'); manifest.append({'orig': 'crest.png', 'copy': 'crest-other-shot-tiny.png', 'G': None})
    img, G = make(A, S(0.5), (400, 266)); jpeg(img, 75).save(f'{OUT}/crest__real-thumb.png')
    manifest.append({'orig': 'crest.png', 'copy': 'crest__real-thumb.png', 'G': G[:2].tolist()})
    # 3. patterns: a chain-link fence over the whole frame, a checkered floor; different subjects
    def fenced(who, W, H, seed, cell=34, ang=0.785):
        bg = crowd(W, H, seed).filter(ImageFilter.GaussianBlur(3)); p, mk = person(who, (int(W * 0.5), int(H * 0.8)), seed)
        bg.paste(p, (int(W * 0.25), int(H * 0.2)), mk)
        wire = Image.fromarray(fence(W, H, cell, ang, seed)); bg.paste((170, 175, 180), (0, 0), wire); return bg
    A = fenced(src['astronaut.png'], 900, 600, 5); A.save(f'{OUT}/fence.png')
    for name, who, kw in [('fence-other-subject', 'chelsea.png', {}), ('fence-other-subject-2', 'coffee.png', dict(cell=36, ang=0.80))]:
        B = fenced(src[who], 900, 600, 6, **kw); B.save(f'{OUT}/{name}.png'); manifest.append({'orig': 'fence.png', 'copy': name + '.png', 'G': None})
    img, G = make(A, S(0.4), (360, 240)); jpeg(img, 75).save(f'{OUT}/fence__real-thumb.png')
    manifest.append({'orig': 'fence.png', 'copy': 'fence__real-thumb.png', 'G': G[:2].tolist()})
    def floor(who, W, H, seed, shift=0, hor=0.45, sq=1.0):
        a = checker(W + 200, H, H * hor, sq, seed)[:, 100 + shift:100 + shift + W]
        bg = np.asarray(crowd(W, H, seed)).astype(float); fl = a > 0
        bg[fl] = np.stack([a, a, a], -1)[fl]
        im = Image.fromarray(bg.astype('uint8')); p, mk = person(who, (int(W * 0.35), int(H * 0.7)), seed)
        im.paste(p, (int(W * 0.33), int(H * 0.12)), mk); return im
    A = floor(src['astronaut.png'], 900, 600, 7); A.save(f'{OUT}/floor.png')
    B = floor(src['rocket.jpg'], 900, 600, 8, shift=40, hor=0.5, sq=1.1); B.save(f'{OUT}/floor-other-subject.png'); manifest.append({'orig': 'floor.png', 'copy': 'floor-other-subject.png', 'G': None})
    img, G = make(A, S(0.5) @ T(-100, -50), (350, 250)); jpeg(img, 75).save(f'{OUT}/floor__real-crop.png')
    manifest.append({'orig': 'floor.png', 'copy': 'floor__real-crop.png', 'G': G[:2].tolist()})
