#!/usr/bin/env python3
"""assets/images/words/*.webp の「透明でない部分の範囲」を測って、js/pics.js の META に貼る形で出す。
新しい絵を足した時に実行する:  python3 tools/measure_pics.py"""
import glob, numpy as np
from PIL import Image
for f in sorted(glob.glob('assets/images/words/*.webp')):
    a = np.asarray(Image.open(f).convert('RGBA'))[..., 3]
    ys, xs = np.where(a > 40)
    print("    %s: [%d, %d, %d, %d]," % (f.split('/')[-1][:-5], xs.min(), ys.min(), xs.max(), ys.max()))
