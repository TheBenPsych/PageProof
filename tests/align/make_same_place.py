"""Different photos of the same place: the checker must NOT call these copies.
Run by make_test_copies.py (adds to its manifest). Made-up scenes only, no real photos.

1. A stone courthouse front (columns, windows, carved name, a sign pole in front),
   photographed twice from a few steps apart: the columns and pole shift against the wall
   behind them (parallax), the light and the people on the steps differ.
2. A press wall shot from the same spot, someone else standing in front of it.
3. A real stereo pair (motorcycle_left / motorcycle_right): two cameras side by side.
Each comes as a normal-size version and as a tiny one (like a 205 x 170 news thumbnail)."""
import math, os, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

def _wall_texture(W, H, rng):
    # stone blocks: soft noise + mortar lines; made once, shared by both shots
    n = rng.normal(0, 1, (H // 8 + 2, W // 8 + 2))
    n = np.array(Image.fromarray(((n - n.min()) / (np.ptp(n) or 1) * 255).astype('uint8')).resize((W, H), Image.BICUBIC)).astype(float)
    a = 175 + (n - 128) * 0.25 + rng.normal(0, 4, (H, W))
    for y in range(0, H, 46): a[y:y + 3] -= 45
    for j, y in enumerate(range(0, H, 46)):
        for x in range((j % 2) * 70, W, 140): a[y:y + 46, x:x + 3] -= 35
    return np.clip(a, 0, 255)

def courthouse(view, W=1200, H=800, seed=3):
    """view: dict(cam=x shift of the camera in px, light=-1..1, people=seed, tilt=perspective)"""
    rng = np.random.default_rng(seed)
    BW, BH = W + 600, H + 200
    tex = _wall_texture(BW, BH, rng)
    cam = view['cam']
    # depth: wall far (shifts least), columns closer, pole closest
    def off(z): return -cam / z
    ow = int(300 + off(6.0))
    wall = tex[100:100 + H, ow:ow + W].copy()
    img = np.stack([wall * 1.0, wall * 0.97, wall * 0.9], -1)
    im = Image.fromarray(np.clip(img, 0, 255).astype('uint8'))
    d = ImageDraw.Draw(im)
    fb = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf', 46) if os.path.exists('/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf') else ImageFont.load_default()
    wx = -300 + ow  # wall x of the image's left edge
    # carved name on the frieze
    d.rectangle((0, 60, W, 150), fill=(196, 192, 180))
    d.text((150 - wx * 0 - (ow - 300), 80), 'UNITED  STATES  COURT  HOUSE', font=fb, fill=(120, 116, 104))
    # windows on the wall (between and behind the columns)
    for row, y in enumerate([230, 400, 570]):
        for k in range(12):
            x = 40 + k * 130 - (ow - 300)
            wr = random.Random(row * 100 + k)   # each window its own blind, curtain and light
            d.rectangle((x, y, x + 60, y + 105), fill=tuple(wr.randint(25, 90) for _ in range(3)))
            d.rectangle((x + 4, y + 4, x + 56, y + 4 + wr.randint(5, 70)), fill=tuple(wr.randint(120, 220) for _ in range(3)))
            if wr.random() < 0.4: d.ellipse((x + wr.randint(8, 40), y + 60, x + wr.randint(44, 56), y + 98), fill=(wr.randint(150, 255), wr.randint(120, 200), 60))
            d.rectangle((x + 4, y + 4, x + 56, y + 101), outline=(150, 148, 140), width=3)
            d.line((x + 30, y, x + 30, y + 105), fill=(150, 148, 140), width=2); d.line((x, y + 52, x + 60, y + 52), fill=(150, 148, 140), width=2)
    a = np.asarray(im).astype(float)
    # columns: closer than the wall, so they shift more when the camera moves
    oc = off(4.0) - off(6.0)
    light = view['light']
    xs = np.arange(W)
    for k in range(9):
        cx = 105 + k * 135 + oc * 1.0 - (ow - 300)
        r = 38
        u = (xs - cx) / r
        inside = np.abs(u) < 1
        if not inside.any(): continue
        nx = u[inside]; nz = np.sqrt(np.clip(1 - nx ** 2, 0, 1))
        shade = 0.45 + 0.55 * np.clip(nz * 0.8 + nx * light * 0.6, 0, 1)
        flute = 1 - 0.12 * (np.cos(nx * 9 * math.pi) > 0.6)
        col = 215 * shade * flute
        a[175:H - 90, inside] = col[None, :, None] * [1.0, 0.98, 0.93]
        # capitals
        x0, x1 = int(cx - r - 10), int(cx + r + 10)
        a[160:178, max(0, x0):max(0, x1)] = [205 + 20 * light, 200 + 20 * light, 188]
    # steps
    for s in range(5): a[H - 90 + s * 18:H - 90 + s * 18 + 3] *= 0.6
    im = Image.fromarray(np.clip(a, 0, 255).astype('uint8')); d = ImageDraw.Draw(im)
    # a sign pole in front: closest, shifts most
    px = int(980 + off(1.6) - off(6.0) - (ow - 300))
    d.rectangle((px, 200, px + 9, H - 40), fill=(70, 60, 40)); d.rectangle((px - 34, 380, px + 44, 402), fill=(20, 20, 20)); d.text((px - 26, 382), 'ONE WAY', fill='white')
    # people on the steps (different each time)
    pr = random.Random(view['people'])
    for i in range(7):
        x, y = pr.randint(0, W - 40), H - pr.randint(30, 100); c = tuple(pr.randint(20, 200) for _ in range(3))
        d.ellipse((x + 10, y - 70, x + 28, y - 52), fill=(200, 160, 130)); d.rectangle((x + 4, y - 52, x + 34, y), fill=c)
    # the second shot: a slightly different angle and light
    t = view.get('tilt', 0)
    if t: im = im.transform((W, H), Image.PERSPECTIVE, (1, t * 0.4, -t * 150, t * 0.1, 1 + t * 0.2, -t * 60, t * 0.00004, 0), Image.BICUBIC)
    return ImageEnhance.Brightness(im).enhance(view.get('bright', 1.0))

def press(wall, person_src, box, D, sc=1.0, dx=0, dy=0, squeeze=1.0, rot=0):
    w = wall(1000, 640, sc, dx, dy)
    p = Image.open(os.path.join(D, person_src)).convert('RGB')
    if rot: p = p.rotate(rot, Image.BICUBIC, expand=False)
    p = p.resize((int((box[2] - box[0]) * squeeze), box[3] - box[1]))
    mk = Image.new('L', p.size, 0); ImageDraw.Draw(mk).ellipse((0, 0, p.width, p.height * 1.6), fill=255)
    w.paste(p, box[:2], mk.filter(ImageFilter.GaussianBlur(6))); return w

def add_cases(OUT, D, manifest, wall, make, S, T, jpeg):
    # 1. courthouse, original = shot A at 600 x 400 (like Ben's 600 x 400 photo)
    A = courthouse(dict(cam=0, light=0.4, people=1)).resize((600, 400), Image.LANCZOS)
    A.save(f'{OUT}/court.png')
    others = {
        'court-other-shot': dict(cam=60, light=0.1, people=2, tilt=0.03, bright=0.92),
        'court-other-shot-close': dict(cam=25, light=0.3, people=3, bright=1.05),
    }
    for name, v in others.items():
        B = courthouse(v)
        B.resize((600, 400), Image.LANCZOS).save(f'{OUT}/{name}.png'); manifest.append({'orig': 'court.png', 'copy': name + '.png', 'G': None})
        # tiny news thumbnail: wider crop, 205 x 170
        t = B.crop((60, 40, 1140, 935 if B.height > 935 else B.height)).resize((205, 170), Image.LANCZOS)
        jpeg(t, 70).save(f'{OUT}/{name}-tiny.png'); manifest.append({'orig': 'court.png', 'copy': name + '-tiny.png', 'G': None})
    # real copies of the courthouse shot must still be found: tiny thumbnail, blurry upscale
    img, G = make(A, S(0.34) @ T(-30, -20), (190, 125)); jpeg(img, 70).save(f'{OUT}/court__real-copy-tiny.png')
    manifest.append({'orig': 'court.png', 'copy': 'court__real-copy-tiny.png', 'G': G[:2].tolist()})
    # 2. press wall from the same spot (the wall lines up exactly), someone else in front
    wo = Image.open(f'{OUT}/wall.png')
    for name, src, kw in [('wall-same-spot-other-person', 'coffee.png', dict(sc=1.0, dx=4, dy=3)),
                          ('wall-zoomed-other-person', 'rocket.jpg', dict(sc=1.15, dx=-30, dy=10))]:
        c = press(wall, src, (150, 80, 590, 640), D, **kw)
        c.save(f'{OUT}/{name}.png'); manifest.append({'orig': 'wall.png', 'copy': name + '.png', 'G': None})
        jpeg(c.resize((260, 166), Image.LANCZOS), 70).save(f'{OUT}/{name}-tiny.png'); manifest.append({'orig': 'wall.png', 'copy': name + '-tiny.png', 'G': None})
    img, G = make(wo, S(0.26), (260, 166)); jpeg(img, 70).save(f'{OUT}/wall__real-copy-tiny.png')
    manifest.append({'orig': 'wall.png', 'copy': 'wall__real-copy-tiny.png', 'G': G[:2].tolist()})
    # 3. real stereo pair: two cameras a few cm apart
    R = Image.open(os.path.join(D, 'motorcycle_right.png')).convert('RGB')
    Lw = Image.open(f'{OUT}/motorcycle_left.png').size
    R = R.resize(Lw, Image.LANCZOS); R.save(f'{OUT}/stereo-right.png'); manifest.append({'orig': 'motorcycle_left.png', 'copy': 'stereo-right.png', 'G': None})
    jpeg(R.resize((R.width // 4, R.height // 4), Image.LANCZOS), 70).save(f'{OUT}/stereo-right-tiny.png'); manifest.append({'orig': 'motorcycle_left.png', 'copy': 'stereo-right-tiny.png', 'G': None})
