"""
Study Flow Organizer - Icon Generator
Generates multi-resolution Windows .ico and .png assets
Using the Master 5-Color Palette:
#283D3B (Dark Slate), #197278 (Stormy Teal), #EDDDD4 (Powder Petal), #C44536 (Tomato Jam), #772E25 (Chestnut)
"""

import os
from PIL import Image, ImageDraw

def create_study_flow_icon(size=1024):
    # High-resolution canvas
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    scale = size / 256.0

    def s(coord):
        if isinstance(coord, (list, tuple)):
            return [c * scale for c in coord]
        return coord * scale

    # 1. Base Squircle in Dark Slate (#283D3B) with subtle lighting
    r = s(54)
    # Background rounded rectangle
    draw.rounded_rectangle([s(8), s(8), s(248), s(248)], radius=r, fill="#283D3B")
    # Inner border in Powder Petal with opacity (#EDDDD4 at 20%)
    draw.rounded_rectangle([s(8), s(8), s(248), s(248)], radius=r, outline=(237, 221, 212, 50), width=int(s(3)))

    # 2. Mortarboard Cap Diamond in Stormy Teal (#197278)
    cap_points = [
        (s(128), s(44)),
        (s(218), s(86)),
        (s(128), s(124)),
        (s(38), s(86))
    ]
    draw.polygon(cap_points, fill="#197278")
    # Subtle cap top highlight line in Powder Petal
    draw.line([(s(128), s(48)), (s(212), s(86))], fill=(237, 221, 212, 120), width=int(s(2)))

    # Mortarboard skullcap base
    base_points = [
        (s(70), s(100)),
        (s(70), s(130)),
        (s(95), s(155)),
        (s(128), s(158)),
        (s(161), s(155)),
        (s(186), s(130)),
        (s(186), s(100)),
        (s(170), s(108)),
        (s(128), s(124)),
        (s(86), s(108))
    ]
    draw.polygon(base_points, fill="#135256")

    # Tassel Ribbon in Tomato Jam (#C44536)
    tassel_points = [
        (s(204), s(88)),
        (s(210), s(138)),
        (s(205), s(160)),
        (s(214), s(160)),
        (s(212), s(138))
    ]
    draw.line([(s(204), s(88)), (s(210), s(142))], fill="#C44536", width=int(s(4)))
    draw.rounded_rectangle([s(204), s(142), s(216), s(164)], radius=s(3), fill="#C44536")
    draw.ellipse([s(205), s(138), s(211), s(144)], fill="#EDDDD4")

    # Button at center of cap
    draw.ellipse([s(123), s(80), s(133), s(90)], fill="#EDDDD4")

    # 3. Open Academic Book in Powder Petal (#EDDDD4)
    # Left Page
    left_page = [
        (s(123), s(164)),
        (s(95), s(152)),
        (s(42), s(162)),
        (s(42), s(208)),
        (s(95), s(198)),
        (s(123), s(210))
    ]
    draw.polygon(left_page, fill="#EDDDD4")
    # Left page lines in Dark Slate
    draw.line([(s(55), s(176)), (s(112), s(174))], fill=(40, 61, 59, 140), width=int(s(3)))
    draw.line([(s(55), s(188)), (s(112), s(186))], fill=(40, 61, 59, 140), width=int(s(3)))

    # Right Page
    right_page = [
        (s(133), s(164)),
        (s(161), s(152)),
        (s(214), s(162)),
        (s(214), s(208)),
        (s(161), s(198)),
        (s(133), s(210))
    ]
    draw.polygon(right_page, fill="#EDDDD4")
    # Right page lines in Dark Slate
    draw.line([(s(144), s(174)), (s(201), s(176))], fill=(40, 61, 59, 140), width=int(s(3)))
    draw.line([(s(144), s(186)), (s(201), s(188))], fill=(40, 61, 59, 140), width=int(s(3)))

    # Book Spine Center Marker in Chestnut (#772E25)
    spine = [
        (s(124), s(166)),
        (s(132), s(166)),
        (s(132), s(211)),
        (s(124), s(211))
    ]
    draw.polygon(spine, fill="#772E25")

    return img

if __name__ == '__main__':
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    app_dir = os.path.join(root_dir, 'app')
    scripts_dir = os.path.join(root_dir, 'scripts')

    master_img = create_study_flow_icon(1024)

    # Save high-res PNGs
    img_256 = master_img.resize((256, 256), Image.Resampling.LANCZOS)
    img_256.save(os.path.join(app_dir, 'icon.png'), format='PNG')
    img_256.save(os.path.join(root_dir, 'icon.png'), format='PNG')

    # Save multi-resolution Windows ICO with standard BMP format for Windows PE compatibility
    ico_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    ico_path_app = os.path.join(app_dir, 'favicon.ico')
    ico_path_root = os.path.join(root_dir, 'Study_Flow_Organizer.ico')
    ico_path_scripts = os.path.join(scripts_dir, 'app.ico')

    img_256.save(ico_path_app, format='ICO', bitmap_format='bmp', sizes=ico_sizes)
    img_256.save(ico_path_root, format='ICO', bitmap_format='bmp', sizes=ico_sizes)
    img_256.save(ico_path_scripts, format='ICO', sizes=ico_sizes, bitmap_format='bmp')

    print("Successfully generated all icons:")
    print(" - app/icon.png")
    print(" - app/favicon.ico")
    print(" - Study_Flow_Organizer.ico")
    print(" - scripts/app.ico")
