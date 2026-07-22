#!/usr/bin/env python3
"""Merge High-Res PNG Images into a Single Page-Fit PDF.
Usage:
    python merge_images_to_pdf.py --images "img1.png,img2.png" --output "output.pdf"
"""

import os
import sys
import argparse

# Windows 환경에서 유니코드 출력 코덱 에러 방지
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except AttributeError:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

try:
    from reportlab.lib.pagesizes import A4

    from reportlab.platypus import SimpleDocTemplate, Image, PageBreak
    from reportlab.lib.units import inch
except ImportError:
    print("❌ reportlab 라이브러리가 필요합니다.")
    sys.exit(1)

from reportlab.pdfgen import canvas

def merge_images(image_paths, output_pdf):
    # A4 크기 (595.27 x 841.89 points)
    width, height = A4
    c = canvas.Canvas(output_pdf, pagesize=A4)
    
    for idx, path in enumerate(image_paths):
        if not os.path.exists(path):
            print(f"❌ 이미지가 존재하지 않습니다: {path}")
            continue
            
        print(f"➡️ Adding page {idx+1}: {os.path.basename(path)}")
        # 여백 없이 A4 전체 화면에 꽉 차도록 캔버스에 직접 드로잉!
        c.drawImage(path, 0, 0, width=width, height=height)
        c.showPage()
            
    try:
        c.save()
        print(f"✅ PDF 결합 및 저장 완료: {output_pdf}")
    except Exception as e:
        print(f"❌ PDF 생성 중 실패: {e}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Merge Images to PDF")
    parser.add_argument("--images", required=True, help="Comma-separated image paths")
    parser.add_argument("--output", required=True, help="Output PDF file path")
    args = parser.parse_args()
    
    image_paths = [p.strip() for p in args.images.split(",") if p.strip()]
    merge_images(image_paths, args.output)

if __name__ == "__main__":
    main()
