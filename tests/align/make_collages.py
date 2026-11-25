"""Real copies that are only PART of a bigger picture: the checker MUST call these copies.
Run by make_test_copies.py (adds to its manifest). Test photos only (scikit-image samples).

1. Inset: a crop of the photo with another photo pasted over one corner (picture-in-picture,
   like a news thumbnail showing the lawyer's face over the courtroom shot).
2. Side by side: another photo on the left half, the photo (cut to fit) on the right half.
3. Stacked: the photo on top, another below.
4. Three panels: the photo in the middle panel."""
import os
import numpy as np
from PIL import Image, ImageDraw


def add_cases(OUT, D, manifest, make, S, T, jpeg):
    def load(n): return Image.open(os.path.join(D, n)).convert('RGB')
    for oname, others in [('astronaut', ['coffee.png', 'chelsea.png']), ('chelsea', ['rocket.jpg', 'astronaut.png']), ('coffee', ['motorcycle_left.png', 'astronaut.png'])]:
        A = Image.open(f'{OUT}/{oname}.png').convert('RGB'); W, H = A.size   # as saved (700 px)
        o1, o2 = load(others[0]), load(others[1])

        # 1. inset: crop 10%..86% wide, 15%..95% tall, shrink to 0.45, other photo over the top left
        s = 0.45; F = S(s) @ T(-W * 0.10, -H * 0.15); cw, ch = int(W * 0.76 * s), int(H * 0.80 * s)
        img, G = make(A, F, (cw, ch))
        iw, ih = int(cw * 0.36), int(ch * 0.42)
        img.paste(o1.resize((iw, ih)), (int(cw * 0.03), int(ch * 0.05)))
        ImageDraw.Draw(img).rectangle((int(cw * 0.03), int(ch * 0.05), int(cw * 0.03) + iw, int(ch * 0.05) + ih), outline=(235, 235, 235), width=2)
        add(OUT, manifest, oname, 'collage-inset', jpeg(img, 80), G)

        # 1b. like a news thumbnail: small (about 280 px), a bigger inset with a light border
        s = 0.40; F = S(s) @ T(-W * 0.02, -H * 0.10); cw, ch = int(W * 0.76 * s), int(H * 0.76 * s)
        img, G = make(A, F, (cw, ch))
        iw, ih = int(cw * 0.36), int(ch * 0.46)
        img.paste(o2.resize((iw, ih)), (int(cw * 0.02), int(ch * 0.04)))
        ImageDraw.Draw(img).rectangle((int(cw * 0.02), int(ch * 0.04), int(cw * 0.02) + iw, int(ch * 0.04) + ih), outline=(220, 220, 220), width=1)
        add(OUT, manifest, oname, 'collage-inset-small', jpeg(img, 75), G)

        # 2. side by side, 1200 x 800: other photo left, the photo cut to a 600 x 800 panel right
        PW, PH = 600, 800; s = max(PW / W, PH / H) * 1.05
        F = T(PW, 0) @ T(PW / 2, PH / 2) @ S(s) @ T(-W / 2, -H / 2)
        img, G = make(A, F, (2 * PW, PH))
        img.paste(o1.resize((PW, PH)), (0, 0))
        add(OUT, manifest, oname, 'collage-side-by-side', jpeg(img, 82), G)

        # 3. stacked: the photo (shrunk) on top, another photo below, a white gap between
        s = 0.6; cw, ch = int(W * s), int(H * s)
        F = S(s); img, G = make(A, F, (cw, 2 * ch + 8))
        img.paste((255, 255, 255), (0, ch, cw, ch + 8)); img.paste(o2.resize((cw, ch)), (0, ch + 8))
        add(OUT, manifest, oname, 'collage-stacked', jpeg(img, 82), G)

        # 4. three panels side by side, the photo in the middle (cut to a narrow panel)
        PW, PH = 300, 400; s = PH / H * 1.0
        F = T(PW, 0) @ T(PW / 2, PH / 2) @ S(s) @ T(-W / 2, -H / 2)
        img, G = make(A, F, (3 * PW, PH))
        img.paste(o1.resize((PW, PH)), (0, 0)); img.paste(o2.resize((PW, PH)), (2 * PW, 0))
        add(OUT, manifest, oname, 'collage-three-panels', jpeg(img, 82), G)


def add(OUT, manifest, oname, name, img, G):
    fn = f'{OUT}/{oname}__{name}.png'; img.save(fn)
    manifest.append({'orig': f'{oname}.png', 'copy': os.path.basename(fn), 'G': G[:2].tolist(), 'cw': img.width, 'ch': img.height})
