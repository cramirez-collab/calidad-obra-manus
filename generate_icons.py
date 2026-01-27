#!/usr/bin/env python3
import cairosvg
import os

sizes = [16, 32, 48, 72, 96, 128, 144, 152, 180, 192, 384, 512]
svg_path = 'client/public/icon-192.svg'
output_dir = 'client/public'

for size in sizes:
    output_path = os.path.join(output_dir, f'icon-{size}.png')
    cairosvg.svg2png(url=svg_path, write_to=output_path, output_width=size, output_height=size)
    print(f'Generated {output_path}')

# Copy 192 as favicon
import shutil
shutil.copy(os.path.join(output_dir, 'icon-192.png'), os.path.join(output_dir, 'favicon.png'))
print('Generated favicon.png')
