"""Makes altered copies of test photos (crops, stretches, turns, mirrors, blur, colour,
headlines, AI-style edits...) with the exact geometry of each, for tests/align/run_tests.js.
Needs: pip install pillow numpy scikit-image"""
import json, math, os, random, io, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance, ImageOps
import skimage.data as sd
OUT = sys.argv[1]; random.seed(7); np.random.seed(7)
os.makedirs(OUT, exist_ok=True)
D = sd.__path__[0]
# Optional: your own photo as a 2nd argument (it gets every variant).
srcs = {'mine': Image.open(sys.argv[2]).convert('RGB')} if len(sys.argv) > 2 else {}
for n in ['astronaut.png', 'coffee.png', 'chelsea.png', 'rocket.jpg', 'motorcycle_left.png']:
    srcs[n.split('.')[0]] = Image.open(os.path.join(D, n)).convert('RGB')
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def M(a, b, c, d, e, f): return np.array([[a, b, c], [d, e, f], [0, 0, 1.0]])
def T(x, y): return M(1, 0, x, 0, 1, y)
def S(x, y=None): return M(x, 0, 0, 0, x if y is None else y, 0)
def R(deg):
    t = math.radians(deg); return M(math.cos(t), -math.sin(t), 0, math.sin(t), math.cos(t), 0)
def make(A, F, size, fill=(255, 255, 255)):
    # F maps original -> copy pixel coords; PIL wants copy -> original.
    G = np.linalg.inv(F)
    img = A.transform(size, Image.AFFINE, data=tuple(G[:2].flatten()), resample=Image.BICUBIC, fillcolor=fill)
    return img, G
def jpeg(img, q):
    b = io.BytesIO(); img.save(b, 'JPEG', quality=q); b.seek(0); return Image.open(b).convert('RGB')
def text(img, s, y, size, fill='white'):
    d = ImageDraw.Draw(img); f = ImageFont.truetype(FONT, size); d.text((img.width * 0.03, y), s, fill=fill, font=f, stroke_width=max(2, size // 25), stroke_fill='black'); return img
def fit(A, F):
    # copy size = bounding box of the transformed original, origin moved to 0
    W, H = A.size; pts = np.array([[0, 0, 1], [W, 0, 1], [0, H, 1], [W, H, 1]]).T
    q = F @ pts; x0, y0 = q[0].min(), q[1].min()
    F2 = T(-x0, -y0) @ F; return F2, (int(math.ceil(q[0].max() - x0)), int(math.ceil(q[1].max() - y0)))
def centre(A, F_in, out_w, out_h):
    # F_in about the original's centre, then centre the result in out_w x out_h
    W, H = A.size; return T(out_w / 2, out_h / 2) @ F_in @ T(-W / 2, -H / 2)

def variants(A):
    W, H = A.size; V = []
    def add(name, F, size, post=lambda i: i, fill=(255, 255, 255)):
        img, G = make(A, F, size, fill); V.append((name, post(img), G))
    F, sz = fit(A, S(1)); 
    add('crop-centre', T(-W * 0.2, -H * 0.2), (int(W * 0.6), int(H * 0.6)))
    add('zoom-crop-2.5x', S(2.5) @ T(-W * 0.3, -H * 0.25), (int(W * 0.4 * 2.5), int(H * 0.45 * 2.5)))
    add('thumbnail', S(0.25), (int(W * 0.25), int(H * 0.25)))
    add('stretch-wide-15', S(1.15, 1), (int(W * 1.15), H))
    add('squash-narrow-15', S(0.85, 1), (int(W * 0.85), H))
    add('stretch-tall-20', S(1, 1.2), (W, int(H * 1.2)))
    add('squash-short-crop', S(1, 0.8) @ T(-W * 0.1, -H * 0.1), (int(W * 0.8), int(H * 0.8 * 0.8)))
    add('turn-2', centre(A, R(2), W, H), (W, H))
    add('turn-minus-5', centre(A, R(-5), W, H), (W, H))
    add('turn-10-crop', centre(A, R(10) @ S(1.3), W, H), (W, H))
    add('mirror', M(-1, 0, W, 0, 1, 0), (W, H))
    add('mirror-zoom-crop', S(1.5) @ M(-1, 0, W, 0, 1, 0) @ T(0, -H * 0.1), (int(W * 1.2), int(H * 1.2)))
    add('jpeg-q8', S(0.7), (int(W * 0.7), int(H * 0.7)), lambda i: jpeg(i, 8))
    add('blurred', S(0.8), (int(W * 0.8), int(H * 0.8)), lambda i: i.filter(ImageFilter.GaussianBlur(2)))
    def noise(i):
        a = np.asarray(i).astype(float) + np.random.normal(0, 18, (i.height, i.width, 3)); return Image.fromarray(np.clip(a, 0, 255).astype('uint8'))
    add('noisy', S(1), (W, H), noise)
    add('greyscale', S(0.9), (int(W * 0.9), int(H * 0.9)), lambda i: ImageOps.grayscale(i).convert('RGB'))
    def grade(i):
        a = np.asarray(i).astype(float); a = a * [0.75, 1.05, 1.15] + [0, 10, 20]; return ImageEnhance.Contrast(Image.fromarray(np.clip(a, 0, 255).astype('uint8'))).enhance(1.3)
    add('teal-colour-grade', S(1.2) @ T(-W * 0.1, -H * 0.1), (int(W), int(H)), grade)
    add('posterised', S(1), (W, H), lambda i: ImageOps.posterize(i, 3))
    add('big-headline', S(1.6) @ T(-W * 0.15, -H * 0.1), (int(W * 1.1), int(H * 1.2)), lambda i: text(text(i, 'BREAKING', i.height * 0.5, int(i.width * 0.16)), 'SCANDAL!', i.height * 0.7, int(i.width * 0.16)))
    def wm(i):
        o = Image.new('RGBA', i.size, (0, 0, 0, 0)); d = ImageDraw.Draw(o); f = ImageFont.truetype(FONT, int(i.width * 0.08))
        for k in range(-2, 6): d.text((k * i.width * 0.25, k * i.height * 0.18), 'STOCKPHOTO', font=f, fill=(255, 255, 255, 110))
        return Image.alpha_composite(i.convert('RGBA'), o).convert('RGB')
    add('watermark', S(1), (W, H), wm)
    def frame(i):
        c = Image.new('RGB', (i.width + 80, i.height + 160), (250, 250, 250)); c.paste(i, (40, 40)); text(c, 'Photo: someone else', i.height + 70, 36, 'black'); return c
    img, G = make(A, S(0.9), (int(W * 0.9), int(H * 0.9))); V.append(('frame-and-caption', frame(img), G @ T(-40, -40)))
    def page(i):
        c = Image.new('RGB', (int(i.width * 2.4), int(i.height * 2.2)), (255, 255, 255)); d = ImageDraw.Draw(c)
        d.rectangle((0, 0, c.width, 60), fill=(30, 30, 60)); 
        for k in range(14): d.rectangle((40, 100 + k * 40, c.width - 40, 118 + k * 40), fill=(200, 200, 200))
        c.paste(i, (int(c.width * 0.45), 120)); return c
    V.append(('inside-a-web-page',) + (lambda r: (page(r[0]), T(0, 0) @ r[1] @ T(-int(int(int(W * 0.5) * 2.4) * 0.45), -120)))(make(A, S(0.5), (int(W * 0.5), int(H * 0.5)))))
    def half(i):
        d = ImageDraw.Draw(i); d.rectangle((0, i.height * 0.45, i.width, i.height), fill=(200, 20, 40)); return i
    add('half-covered', S(1), (W, H), half)
    add('stretch-turn-jpeg', centre(A, R(3) @ S(1.1, 1), W, H), (W, H), lambda i: jpeg(i, 30))
    def patches(i):
        a = i.copy()
        for k in range(6):
            x, y = random.randint(0, int(i.width * 0.8)), random.randint(0, int(i.height * 0.8)); w, h = int(i.width * 0.2), int(i.height * 0.2)
            reg = a.crop((x, y, x + w, y + h)).filter(ImageFilter.GaussianBlur(8)).transpose(Image.ROTATE_180); a.paste(reg, (x, y))
        return a
    add('ai-style-patches', S(1), (W, H), patches)
    def wave(i):
        a = np.asarray(i); h, w = a.shape[:2]; out = np.zeros_like(a)
        for y in range(h):
            sh = int(3 * math.sin(y / 25)); out[y] = np.roll(a[y], sh, axis=0)
        return Image.fromarray(out)
    add('ai-style-warp', S(1), (W, H), wave)
    def insta(i):
        i = ImageEnhance.Color(i).enhance(1.5); a = np.asarray(i).astype(float); h, w = a.shape[:2]
        yy, xx = np.mgrid[0:h, 0:w]; v = 1 - 0.6 * (((xx - w / 2) / w) ** 2 + ((yy - h / 2) / h) ** 2) * 2
        a = a * v[..., None] * [1.1, 1.0, 0.85]; return Image.fromarray(np.clip(a, 0, 255).astype('uint8'))
    s0 = min(W, H); add('square-crop-filter', T(-(W - s0) / 2, 0), (s0, s0), insta)
    def stickers(i):
        d = ImageDraw.Draw(i)
        for k in range(10):
            x, y, r = random.randint(0, i.width), random.randint(0, i.height), random.randint(10, int(i.width * 0.06)); d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 220, 0), outline='black', width=3)
        return i
    add('stickers', S(1), (W, H), stickers)
    add('pixelated', S(1), (W, H), lambda i: i.resize((W // 5, H // 5)).resize((W, H), Image.NEAREST))
    add('tiny-region-3x', S(3) @ T(-W * 0.4, -H * 0.4), (int(W * 0.25 * 3), int(H * 0.25 * 3)))
    add('mirror-tall', S(1, 1.1) @ M(-1, 0, W, 0, 1, 0), (W, int(H * 1.1)))
    add('turn-1-wide-text', centre(A, R(1) @ S(1.05, 1), W, H), (W, H), lambda i: text(i, 'EXCLUSIVE', i.height * 0.75, int(i.width * 0.1)))
    add('squash-30', S(0.7, 1), (int(W * 0.7), H))
    add('heavy-jpeg-small', S(0.3), (int(W * 0.3), int(H * 0.3)), lambda i: jpeg(i, 15))
    add('hard-mirror-stretch-turn-headline', centre(A, R(-7) @ S(1.4, 1.2) @ M(-1, 0, 0, 0, 1, 0), W, H), (W, H), lambda i: jpeg(text(i, 'SHOCKING', i.height * 0.6, int(i.width * 0.15)), 25))
    add('hard-turn-15', centre(A, R(15) @ S(1.2), W, H), (W, H))
    add('hard-thumb-tiny', S(0.15), (int(W * 0.15), int(H * 0.15)), lambda i: jpeg(i, 40))
    add('hard-stretch-1.3-blur-grade', S(1.3, 1), (int(W * 1.3), H), lambda i: grade(i.filter(ImageFilter.GaussianBlur(1.5))))
    def persp(i):
        w, h = i.size; return i.transform((w, h), Image.PERSPECTIVE, (1, 0.03, -10, 0.01, 1, -5, 0.00003, 0.00002), Image.BICUBIC)
    add('hard-slight-perspective', S(1), (W, H), persp)
    return V

manifest = []
for sname, A in srcs.items():
    if max(A.size) < 700 and sname != 'mine':
        f = 700 / max(A.size); A = A.resize((round(A.width * f), round(A.height * f)), Image.LANCZOS)
    A.save(f'{OUT}/{sname}.png')
    V = variants(A)
    if sname != 'mine' and len(srcs) > 5: V = random.sample(V[:-5], 8) + V[-5:]
    for name, img, G in V:
        fn = f'{OUT}/{sname}__{name}.png'; img.save(fn)
        manifest.append({'orig': f'{sname}.png', 'copy': os.path.basename(fn), 'G': G[:2].tolist(), 'cw': img.width, 'ch': img.height})
neg = [('coffee.png', 'astronaut.png'), ('chelsea.png', 'astronaut.png'), ('rocket.png', 'coffee.png'), ('motorcycle_left.png', 'chelsea.png')]
for a, c in neg: manifest.append({'orig': a, 'copy': c, 'G': None})
json.dump(manifest, open(f'{OUT}/manifest.json', 'w'))
print(len(manifest))
