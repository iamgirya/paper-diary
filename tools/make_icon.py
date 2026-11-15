import math, sys
from PIL import Image, ImageDraw, ImageFilter

INK = (31, 44, 128, 255)
RULE = (63, 81, 163, 255)
COVER = (36, 52, 130, 255)
COVER_DARK = (24, 34, 92, 255)
PAPER = (252, 249, 239, 255)
GRID = (120, 150, 205, 70)
PEN = (232, 106, 64, 255)


def draw(size):
    k = 4
    S = size * k
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f = lambda v: v * S
    detail = size >= 48
    small = size <= 24

    # shadow
    if not small:
        sh = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        ImageDraw.Draw(sh).rounded_rectangle([f(.15), f(.09), f(.93), f(.97)], radius=f(.08), fill=(0, 0, 0, 90))
        im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(f(.025))))

    # cover peeking out
    if small: d.rounded_rectangle([f(.14), f(.12), f(.96), f(.96)], radius=f(.1), fill=COVER)
    else: d.rounded_rectangle([f(.13), f(.05), f(.91), f(.95)], radius=f(.08), fill=COVER)
    # page
    px0, py0, px1, py1 = (.08, .03, .84, .90) if not small else (.04, .04, .80, .84)
    d.rounded_rectangle([f(px0), f(py0), f(px1), f(py1)], radius=f(.06 if not small else .1), fill=PAPER)

    # grid
    if detail:
        g = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        gd = ImageDraw.Draw(g)
        step = (px1 - px0) / 13
        x = px0 + step
        while x < px1 - 1e-6:
            gd.line([f(x), f(py0), f(x), f(py1)], fill=GRID, width=max(1, int(f(.004))))
            x += step
        y = py0 + step
        while y < py1 - 1e-6:
            gd.line([f(px0), f(y), f(px1), f(y)], fill=GRID, width=max(1, int(f(.004))))
            y += step
        mask = Image.new('L', (S, S), 0)
        ImageDraw.Draw(mask).rounded_rectangle([f(px0), f(py0), f(px1), f(py1)], radius=f(.06), fill=255)
        im.paste(Image.alpha_composite(im, g), (0, 0), mask)
        d = ImageDraw.Draw(im)

    # week layout: header + 7 units (rows of 2, 2, 2 and Sunday 1)
    top = py0 + (py1 - py0) * (0.13 if not small else 0.08)
    unit = (py1 - top) / 7
    mid = (px0 + px1) / 2
    w = max(k, int(f(.022 if not small else .055)))
    for i in (0, 2, 4, 6):
        y = top + unit * i
        d.line([f(px0), f(y), f(px1), f(y)], fill=RULE, width=w)
    d.line([f(mid), f(top), f(mid), f(top + unit * 6)], fill=RULE, width=w)

    # handwriting squiggles
    if not small:
        def scribble(x0, y0, length, amp=.009, freq=11):
            pts = []
            n = 40
            for i in range(n + 1):
                t = i / n
                pts.append((f(x0 + length * t), f(y0 + amp * math.sin(t * freq * math.pi) - amp * .4 * math.sin(t * 3 * math.pi))))
            d.line(pts, fill=INK, width=max(k, int(f(.012))), joint='curve')
        lw = mid - px0
        scribble(px0 + .05, top + unit * .75, lw * .62)
        scribble(px0 + .09, top + unit * 1.3, lw * .45)
        scribble(mid + .04, top + unit * .9, lw * .55)
        scribble(px0 + .06, top + unit * 2.9, lw * .5)
        if detail:
            scribble(mid + .07, top + unit * 4.8, lw * .4)
            scribble(px0 + .12, top + unit * 6.5, (px1 - px0) * .45)

    # day numbers + mood smile
    if detail:
        r = .007
        for (x, y) in [(px0 + .03, top + .028), (mid + .03, top + .028), (px0 + .03, top + unit * 2 + .028)]:
            d.ellipse([f(x - r), f(y - r), f(x + r), f(y + r)], fill=RULE)
        cx, cy, cr = mid - .055, top + unit * 2 + .06, .032
        d.ellipse([f(cx - cr), f(cy - cr), f(cx + cr), f(cy + cr)], fill=(255, 205, 80, 255), outline=(200, 140, 30, 255), width=max(1, int(f(.006))))
        er = .0055
        for ex in (cx - .011, cx + .011):
            d.ellipse([f(ex - er), f(cy - .008 - er), f(ex + er), f(cy - .008 + er)], fill=(90, 60, 20, 255))
        d.arc([f(cx - .017), f(cy - .016), f(cx + .017), f(cy + .016)], 25, 155, fill=(90, 60, 20, 255), width=max(1, int(f(.006))))

    # pen lying diagonally
    if size >= 32:
        pen = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        pd = ImageDraw.Draw(pen)
        L, W = f(.62), f(.075)
        cx, cy = f(.66), f(.70)
        x0, y0 = cx - L / 2, cy - W / 2
        if not small:
            pd.rounded_rectangle([x0 + f(.01), y0 + f(.025), x0 + L + f(.01), y0 + W + f(.025)], radius=W / 2, fill=(0, 0, 0, 70))
        pd.rounded_rectangle([x0 + W * .3, y0, x0 + L, y0 + W], radius=W / 2, fill=PEN)
        pd.rectangle([x0 + L * .78, y0, x0 + L * .84, y0 + W], fill=(250, 220, 120, 255))  # band
        pd.polygon([(x0 + W * .45, y0), (x0 + W * .45, y0 + W), (x0 - W * .7, cy)], fill=(245, 228, 200, 255))  # cone
        pd.polygon([(x0 - W * .25, cy - W * .22), (x0 - W * .25, cy + W * .22), (x0 - W * .7, cy)], fill=INK)  # nib
        pd.line([x0 + W * .8, y0 + W * .28, x0 + L * .74, y0 + W * .28], fill=(255, 255, 255, 80), width=max(1, int(W * .14)))
        pen = pen.rotate(38, center=(cx, cy), resample=Image.BICUBIC)
        im.alpha_composite(pen)

    return im.resize((size, size), Image.LANCZOS)


out = sys.argv[1] if len(sys.argv) > 1 else "icon"
sizes = [16, 24, 32, 48, 64, 128, 256]
imgs = [draw(s) for s in sizes]
imgs[-1].save(out + '.png')
imgs[-1].save(out + '.ico', format='ICO', sizes=[(s, s) for s in sizes], append_images=imgs[:-1])
prev = Image.new('RGBA', (sum(sizes) + 20 * len(sizes), 276), (240, 240, 240, 255))
x = 10
for im in imgs:
    prev.alpha_composite(im, (x, 10)); x += im.width + 20
prev.save(out + '_preview.png')
