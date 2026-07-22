#!/usr/bin/env python3
"""PDF Generator for Designer Agent.
Usage:
    python pdf_generator.py --input "input.md" --output "output.pdf" [--title "Title"]
"""

import os
import sys
import argparse
import json
import re
from datetime import datetime

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
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
except ImportError:
    print("❌ reportlab 라이브러리가 필요합니다. 'pip install reportlab'을 실행해주세요.")
    sys.exit(1)

# 폰트 등록 헬퍼
def register_korean_font():
    # Windows 맑은 고딕 일반 및 볼드 폰트 경로
    win_font = os.path.join(os.environ.get("SystemRoot", "C:\\Windows"), "Fonts", "malgun.ttf")
    win_font_bold = os.path.join(os.environ.get("SystemRoot", "C:\\Windows"), "Fonts", "malgunbd.ttf")
    
    font_name = "Helvetica"
    font_bold_name = "Helvetica-Bold"
    
    if os.path.exists(win_font):
        try:
            pdfmetrics.registerFont(TTFont("KoreanFont", win_font))
            font_name = "KoreanFont"
        except Exception as e:
            print(f"Malgun Gothic font registration failed: {e}", file=sys.stderr)
            
    if os.path.exists(win_font_bold):
        try:
            pdfmetrics.registerFont(TTFont("KoreanFont-Bold", win_font_bold))
            font_bold_name = "KoreanFont-Bold"
        except Exception as e:
            print(f"Malgun Gothic Bold font registration failed: {e}", file=sys.stderr)
    else:
        # 볼드 폰트가 없을 경우 일반 폰트로 맵핑
        if font_name == "KoreanFont":
            pdfmetrics.registerFont(TTFont("KoreanFont-Bold", win_font))
            font_bold_name = "KoreanFont-Bold"
            
    return font_name, font_bold_name

def parse_markdown_to_story(md_text, styles, font_name, font_bold_name):
    story = []
    lines = md_text.split('\n')
    in_list = False
    
    # 표(Table) 파싱 상태 변수
    in_table = False
    table_data = []
    
    # H2 헤더 카운터 (두 번째 H2부터 자동 페이지 나누기 적용)
    h2_count = 0
    
    # 한글 지원 스타일 정의
    title_style = ParagraphStyle(
        'MD_Title',
        parent=styles['Heading1'],
        fontName=font_bold_name,
        fontSize=26,
        leading=32,
        textColor=colors.HexColor('#1E1E30'),
        spaceAfter=20,
        alignment=1
    )
    h2_style = ParagraphStyle(
        'MD_H2',
        parent=styles['Heading2'],
        fontName=font_bold_name,
        fontSize=18,
        leading=24,
        textColor=colors.HexColor('#7C3AED'),
        spaceBefore=15,
        spaceAfter=15,
        alignment=1,
        keepWithNext=True
    )
    h3_style = ParagraphStyle(
        'MD_H3',
        parent=styles['Heading3'],
        fontName=font_bold_name,
        fontSize=13,
        leading=17,
        textColor=colors.HexColor('#06B6D4'),
        spaceBefore=10,
        spaceAfter=8,
        keepWithNext=True
    )
    body_style = ParagraphStyle(
        'MD_Body',
        parent=styles['Normal'],
        fontName=font_name,
        fontSize=10,
        leading=16,
        textColor=colors.HexColor('#4B5563'),
        spaceAfter=12,
        alignment=1
    )
    list_style = ParagraphStyle(
        'MD_List',
        parent=styles['Normal'],
        fontName=font_name,
        fontSize=10.5,
        leading=15,
        leftIndent=40,
        firstLineIndent=-10,
        textColor=colors.HexColor('#374151'),
        spaceAfter=6
    )
    quote_style = ParagraphStyle(
        'MD_Quote',
        parent=styles['Normal'],
        fontName=font_bold_name,
        fontSize=10.5,
        leading=15,
        textColor=colors.HexColor('#7C3AED'),
        alignment=1
    )

    for line in lines:
        stripped = line.strip()
        
        # 1. 표(Table) 처리
        if stripped.startswith('|') and stripped.endswith('|'):
            if not in_table:
                in_table = True
                table_data = []
            
            # 셀 추출
            raw_cells = stripped[1:-1].split('|')
            cells = [c.strip() for c in raw_cells]
            
            # 1.1 마크다운 정렬 구분선 체크 (예: :---:, ---, :---)
            # 모든 셀이 공백, 콜론, 하이픈(-)으로만 이루어져 있다면 마크다운 구분선이므로 무조건 스킵!
            if all(re.match(r'^[\s:-]+$', c) for c in cells if c):
                continue
                
            row_cells = []
            is_header = len(table_data) == 0
            
            cell_style = ParagraphStyle(
                f'Temp_Cell_{len(table_data)}',
                parent=styles['Normal'],
                fontName=font_name,
                fontSize=9.5
            )
            
            for cell in cells:
                text = cell
                text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
                text = re.sub(r'\*(.*?)\*', r'<i>\1</i>', text)
                row_cells.append(Paragraph(text, cell_style))
                
            table_data.append(row_cells)
            continue
        else:
            if in_table:
                if table_data:
                    col_count = max(len(row) for row in table_data)
                    row_count = len(table_data)
                    
                    is_bingo = (col_count == 5 and row_count == 6)
                    
                    if is_bingo:
                        col_width = 85.0
                        row_heights = [35.0] + [75.0] * 5
                        
                        bingo_header_style = ParagraphStyle(
                            'Bingo_Header_Style',
                            parent=styles['Normal'],
                            fontName=font_bold_name,
                            fontSize=14,
                            leading=18,
                            textColor=colors.HexColor('#FFFFFF'),
                            alignment=1
                        )
                        bingo_body_style = ParagraphStyle(
                            'Bingo_Body_Style',
                            parent=styles['Normal'],
                            fontName=font_name,
                            fontSize=11.5,
                            leading=15,
                            textColor=colors.HexColor('#1F2937'),
                            alignment=1
                        )
                        
                        for r_idx, row in enumerate(table_data):
                            for c_idx, cell_para in enumerate(row):
                                text = cell_para.text
                                select_style = bingo_header_style if r_idx == 0 else bingo_body_style
                                row[c_idx] = Paragraph(text, select_style)
                                
                        t = Table(table_data, colWidths=[col_width]*5, rowHeights=row_heights)
                        
                        t_styles = [
                            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#7C3AED')),
                            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                            ('GRID', (0, 0), (-1, -1), 2.0, colors.HexColor('#7C3AED')),
                            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#FFFFFF'), colors.HexColor('#F5F3FF')]),
                        ]
                        
                        t_styles.append(('BACKGROUND', (2, 3), (2, 3), colors.HexColor('#FDE68A')))
                        t_styles.append(('TEXTCOLOR', (2, 3), (2, 3), colors.HexColor('#B45309')))
                        
                        t.setStyle(TableStyle(t_styles))
                        story.append(t)
                        
                    else:
                        is_journal = (col_count <= 3 and row_count >= 5)
                        col_width = 487.0 / col_count if col_count > 0 else 487.0
                        
                        if is_journal:
                            row_heights = [28.0] + [45.0] * (row_count - 1)
                            
                            journal_header_style = ParagraphStyle(
                                'Journal_Header',
                                parent=styles['Normal'],
                                fontName=font_bold_name,
                                fontSize=11,
                                leading=14,
                                textColor=colors.HexColor('#FFFFFF'),
                                alignment=1
                            )
                            journal_body_style = ParagraphStyle(
                                'Journal_Body',
                                parent=styles['Normal'],
                                fontName=font_name,
                                fontSize=10,
                                leading=15,
                                textColor=colors.HexColor('#374151'),
                                alignment=0
                            )
                            
                            for r_idx, row in enumerate(table_data):
                                for c_idx, cell_para in enumerate(row):
                                    text = cell_para.text
                                    select_style = journal_header_style if r_idx == 0 else journal_body_style
                                    row[c_idx] = Paragraph(text, select_style)
                                    
                            t = Table(table_data, colWidths=[col_width]*col_count, rowHeights=row_heights)
                            t.setStyle(TableStyle([
                                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#06B6D4')),
                                ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                                ('GRID', (0, 0), (-1, -1), 1.0, colors.HexColor('#9CA3AF')),
                                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#FFFFFF'), colors.HexColor('#F9FAFB')]),
                                ('LEFTPADDING', (0, 0), (-1, -1), 10),
                                ('RIGHTPADDING', (0, 0), (-1, -1), 10),
                            ]))
                            story.append(t)
                        else:
                            row_heights = [26.0] + [28.0] * (row_count - 1)
                            
                            normal_header_style = ParagraphStyle(
                                'Normal_Header',
                                parent=styles['Normal'],
                                fontName=font_bold_name,
                                fontSize=10,
                                leading=13,
                                textColor=colors.HexColor('#FFFFFF'),
                                alignment=1
                            )
                            normal_body_style = ParagraphStyle(
                                'Normal_Body',
                                parent=styles['Normal'],
                                fontName=font_name,
                                fontSize=9.5,
                                leading=13.5,
                                textColor=colors.HexColor('#374151'),
                                alignment=1
                            )
                            
                            for r_idx, row in enumerate(table_data):
                                for c_idx, cell_para in enumerate(row):
                                    text = cell_para.text
                                    select_style = normal_header_style if r_idx == 0 else normal_body_style
                                    row[c_idx] = Paragraph(text, select_style)
                                    
                            t = Table(table_data, colWidths=[col_width]*col_count, rowHeights=row_heights)
                            t.setStyle(TableStyle([
                                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#7C3AED')),
                                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
                                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#FFFFFF'), colors.HexColor('#F9FAFB')]),
                            ]))
                            story.append(t)
                    
                    story.append(Spacer(1, 15))
                in_table = False
                table_data = []

        # 2. 빈 줄 처리
        if not stripped:
            if in_list:
                in_list = False
            story.append(Spacer(1, 4))
            continue
            
        # 3. 수평선(HR) 처리
        if stripped == '---':
            story.append(Spacer(1, 10))
            hr_table = Table([['']], colWidths=[487.0], rowHeights=[1.0])
            hr_table.setStyle(TableStyle([
                ('LINEABOVE', (0, 0), (-1, -1), 1.0, colors.HexColor('#E5E7EB')),
            ]))
            story.append(hr_table)
            story.append(Spacer(1, 10))
            continue
            
        # 4. 마크다운 헤더 파싱 및 페이지 분할 처리
        if stripped.startswith('# '):
            story.append(Paragraph(stripped[2:], title_style))
            story.append(Spacer(1, 15))
        elif stripped.startswith('## '):
            h2_count += 1
            if h2_count > 1:
                story.append(PageBreak())
                story.append(Spacer(1, 20))
            story.append(Paragraph(stripped[3:], h2_style))
            story.append(Spacer(1, 8))
        elif stripped.startswith('### '):
            story.append(Paragraph(stripped[4:], h3_style))
            story.append(Spacer(1, 6))
            
        # 5. 블록 인용구 (Callout Box 스타일로 렌더링)
        elif stripped.startswith('> '):
            text = stripped[2:]
            text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
            text = re.sub(r'\*(.*?)\*', r'<i>\1</i>', text)
            
            p = Paragraph(text, quote_style)
            quote_table = Table([[p]], colWidths=[487.0])
            quote_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F5F3FF')),
                ('LINELEFT', (0, 0), (0, -1), 3.5, colors.HexColor('#7C3AED')),
                ('TOPPADDING', (0, 0), (-1, -1), 12),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
                ('LEFTPADDING', (0, 0), (-1, -1), 18),
                ('RIGHTPADDING', (0, 0), (-1, -1), 18),
            ]))
            story.append(quote_table)
            story.append(Spacer(1, 12))
            
        # 6. 리스트 아이템
        elif stripped.startswith('- ') or stripped.startswith('* '):
            in_list = True
            text = stripped[2:]
            text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
            text = re.sub(r'\*(.*?)\*', r'<i>\1</i>', text)
            story.append(Paragraph(f"• {text}", list_style))
        elif re.match(r'^\d+\.\s', stripped):
            in_list = True
            match = re.match(r'^(\d+)\.\s(.*)', stripped)
            num = match.group(1)
            content = match.group(2)
            content = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', content)
            content = re.sub(r'\*(.*?)\*', r'<i>\1</i>', content)
            story.append(Paragraph(f"{num}. {content}", list_style))
            
        # 7. 일반 텍스트
        else:
            text = stripped
            text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
            text = re.sub(r'\*(.*?)\*', r'<i>\1</i>', text)
            story.append(Paragraph(text, body_style))
            
    return story

def main():
    parser = argparse.ArgumentParser(description="Markdown to PDF Generator")
    parser.add_argument("--input", required=True, help="Input Markdown file path")
    parser.add_argument("--output", required=True, help="Output PDF file path")
    parser.add_argument("--title", default="PDF Report", help="Document Title")
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"❌ 입력 파일이 존재하지 않습니다: {args.input}")
        sys.exit(1)

    try:
        with open(args.input, "r", encoding="utf-8") as f:
            md_text = f.read()
    except Exception as e:
        print(f"❌ 입력 파일 읽기 실패: {e}")
        sys.exit(1)

    print(f"📄 Processing: {args.input}...")

    # 폰트 등록
    font_name, font_bold_name = register_korean_font()
    print(f"ℹ️ Using Fonts: Normal='{font_name}', Bold='{font_bold_name}'")

    # 스타일 시트 초기화
    styles = getSampleStyleSheet()
    
    # 문서 생성 설정 (A4 크기, 상하좌우 여백 20mm 대신 15mm로 여백을 좀더 넓게 쓰기)
    doc = SimpleDocTemplate(
        args.output,
        pagesize=A4,
        leftMargin=54, rightMargin=54,
        topMargin=54, bottomMargin=54
    )

    # 스토리 구성
    story = []
    
    # 타이틀 카드 추가
    title_p_style = ParagraphStyle(
        'Main_Title',
        parent=styles['Normal'],
        fontName=font_bold_name,
        fontSize=28,
        leading=34,
        textColor=colors.HexColor('#1E1E30'),
        alignment=1, # Center
        spaceAfter=15
    )
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontName=font_name,
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#7C3AED'),
        alignment=1,
        spaceAfter=30
    )
    
    story.append(Spacer(1, 40))
    story.append(Paragraph(args.title, title_p_style))
    story.append(Paragraph(f"Generated on {datetime.now().strftime('%Y-%m-%d')}", subtitle_style))
    story.append(Spacer(1, 20))
    story.append(PageBreak()) # 페이지 나누기 (표지 후 본문 시작)

    # 마크다운 파싱하여 스토리 추가
    md_story = parse_markdown_to_story(md_text, styles, font_name, font_bold_name)
    story.extend(md_story)

    # PDF 빌드 실행
    try:
        doc.build(story)
        print(f"✅ PDF 빌드 완료: {args.output}")
    except Exception as e:
        print(f"❌ PDF 빌드 실패: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
