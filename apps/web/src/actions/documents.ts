'use server';

/**
 * Hands Free â€” Document Generation Actions (Excel Â· Word Â· PDF)
 *
 * Uses:
 *   xlsx     â€” Excel (.xlsx) read / write / formula evaluation
 *   docx     â€” Word  (.docx) generation
 *   pdf-lib  â€” PDF   (.pdf)  generation / manipulation
 *
 * For any document-creation request (e.g. "Create a resume"), BOTH
 * a .docx AND a .pdf are generated and returned together so the user
 * gets the best of both worlds.
 *
 * Files are written to DATA_DIR/documents/ and paths returned to caller.
 */

import path from 'path';
import fs   from 'fs';
import { DATA_DIR } from '@/lib/paths';

const DOCS_DIR = path.join(DATA_DIR, 'documents');

function ensureDocsDir() {
    if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });
}

function safeName(name: string): string {
    return name.replace(/[^a-z0-9_\-\.]/gi, '_').slice(0, 100);
}

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface ExcelCell {
    value: string | number | boolean | null;
    formula?: string; // e.g. "=SUM(B2:B10)"
    bold?: boolean;
    italic?: boolean;
    color?: string;   // hex e.g. "FF0000"
    bgColor?: string;
    align?: 'left' | 'center' | 'right';
    numFmt?: string;  // e.g. '#,##0.00' | 'YYYY-MM-DD'
}

export interface ExcelSheet {
    name: string;
    headers?: string[];
    rows: (ExcelCell | string | number | null)[][];
    columnWidths?: number[]; // character widths
    freezeRow?: number;      // freeze first N rows
}

export interface WordSection {
    type: 'heading' | 'paragraph' | 'bullet' | 'table' | 'divider' | 'pageBreak';
    level?: 1 | 2 | 3 | 4;    // for headings
    text?: string;             // for heading / paragraph / bullet
    items?: string[];          // for bullet lists
    tableHeaders?: string[];   // for tables
    tableRows?: string[][];    // for tables
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    align?: 'LEFT' | 'CENTER' | 'RIGHT' | 'BOTH';
    fontSize?: number;         // half-points; 24 = 12pt
    color?: string;            // hex
    spaceBefore?: number;      // twips
    spaceAfter?: number;       // twips
}

export interface DocumentResult {
    success:    boolean;
    docxPath?:  string;
    pdfPath?:   string;
    xlsxPath?:  string;
    error?:     string;
}

// â”€â”€â”€ Excel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Create a multi-sheet Excel workbook.
 * Returns the path to the saved .xlsx file.
 */
export async function createExcelFile(options: {
    filename:  string;
    sheets:    ExcelSheet[];
    author?:   string;
}): Promise<DocumentResult> {
    try {
        ensureDocsDir();
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const XLSX = require('xlsx');

        const wb = XLSX.utils.book_new();
        if (options.author) wb.Props = { Author: options.author };

        for (const sheet of options.sheets) {
            const aoa: any[][] = [];

            // Header row
            if (sheet.headers?.length) {
                aoa.push(sheet.headers);
            }

            // Data rows
            for (const row of sheet.rows) {
                aoa.push(
                    row.map((cell) => {
                        if (cell === null || cell === undefined) return '';
                        if (typeof cell === 'object' && 'value' in cell) {
                            if ((cell as ExcelCell).formula) return { f: (cell as ExcelCell).formula };
                            return (cell as ExcelCell).value;
                        }
                        return cell;
                    }),
                );
            }

            const ws = XLSX.utils.aoa_to_sheet(aoa);

            // Column widths
            if (sheet.columnWidths?.length) {
                ws['!cols'] = sheet.columnWidths.map((w) => ({ wch: w }));
            }

            // Freeze rows
            if (sheet.freezeRow) {
                ws['!freeze'] = { xSplit: 0, ySplit: sheet.freezeRow };
            }

            XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
        }

        const filename = safeName(options.filename.endsWith('.xlsx') ? options.filename : `${options.filename}.xlsx`);
        const filePath = path.join(DOCS_DIR, filename);
        XLSX.writeFile(wb, filePath);

        return { success: true, xlsxPath: filePath };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Read an Excel file and return its contents as JSON.
 */
export async function readExcelFile(options: {
    filePath: string;
    sheetName?: string;
}): Promise<{ success: boolean; data?: Record<string, any[][]>; error?: string }> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const XLSX = require('xlsx');
        const wb   = XLSX.readFile(options.filePath);
        const data: Record<string, any[][]> = {};
        const names = options.sheetName ? [options.sheetName] : wb.SheetNames;

        for (const name of names) {
            if (!wb.Sheets[name]) continue;
            data[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null });
        }

        return { success: true, data };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// â”€â”€â”€ Word (.docx) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Internal helper: build a docx Document from WordSection[].
 */
async function buildDocxDocument(sections: WordSection[], meta?: { title?: string; author?: string }) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {
        Document, Packer, Paragraph, TextRun, HeadingLevel,
        Table, TableRow, TableCell, WidthType, AlignmentType,
        BorderStyle, PageBreak,
    } = require('docx');

    const HEADING_MAP: Record<number, string> = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4,
    };

    const ALIGN_MAP: Record<string, string> = {
        LEFT:   AlignmentType.LEFT,
        CENTER: AlignmentType.CENTER,
        RIGHT:  AlignmentType.RIGHT,
        BOTH:   AlignmentType.BOTH,
    };

    const children: any[] = [];

    for (const sec of sections) {
        switch (sec.type) {
            case 'heading': {
                children.push(
                    new Paragraph({
                        text:         sec.text ?? '',
                        heading:      HEADING_MAP[sec.level ?? 1] ?? HeadingLevel.HEADING_1,
                        alignment:    sec.align ? ALIGN_MAP[sec.align] : undefined,
                        spacing:      { before: sec.spaceBefore ?? 240, after: sec.spaceAfter ?? 120 },
                    }),
                );
                break;
            }
            case 'paragraph': {
                const runs: any[] = [];
                if (sec.text) {
                    runs.push(new TextRun({
                        text:      sec.text,
                        bold:      sec.bold,
                        italics:   sec.italic,
                        underline: sec.underline ? {} : undefined,
                        size:      sec.fontSize ?? 24,
                        color:     sec.color,
                    }));
                }
                children.push(
                    new Paragraph({
                        children:  runs,
                        alignment: sec.align ? ALIGN_MAP[sec.align] : AlignmentType.LEFT,
                        spacing:   { before: sec.spaceBefore ?? 0, after: sec.spaceAfter ?? 160 },
                    }),
                );
                break;
            }
            case 'bullet': {
                const items = sec.items ?? (sec.text ? [sec.text] : []);
                for (const item of items) {
                    children.push(
                        new Paragraph({
                            text:          item,
                            bullet:        { level: 0 },
                            spacing:       { after: 80 },
                        }),
                    );
                }
                break;
            }
            case 'table': {
                if (!sec.tableRows?.length) break;
                const allRows: any[] = [];

                if (sec.tableHeaders?.length) {
                    allRows.push(
                        new TableRow({
                            children: sec.tableHeaders.map((h) =>
                                new TableCell({
                                    children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
                                    width:    { size: Math.floor(9000 / sec.tableHeaders!.length), type: WidthType.DXA },
                                }),
                            ),
                        }),
                    );
                }

                for (const row of sec.tableRows) {
                    allRows.push(
                        new TableRow({
                            children: row.map((cell, i) =>
                                new TableCell({
                                    children: [new Paragraph({ text: cell })],
                                    width:    { size: Math.floor(9000 / ((sec.tableHeaders?.length ?? row.length) || 1)), type: WidthType.DXA },
                                }),
                            ),
                        }),
                    );
                }

                children.push(
                    new Table({
                        rows:  allRows,
                        width: { size: 9000, type: WidthType.DXA },
                    }),
                );
                break;
            }
            case 'divider': {
                children.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'AAAAAA' } } }));
                break;
            }
            case 'pageBreak': {
                children.push(new Paragraph({ children: [new PageBreak()] }));
                break;
            }
        }
    }

    return new Document({
        creator:     meta?.author ?? 'Hands Free',
        title:       meta?.title ?? 'Document',
        sections: [{ children }],
    });
}

/**
 * Generate a Word document from structured sections.
 * Returns the path to the saved .docx file.
 */
export async function createWordDocument(options: {
    filename: string;
    sections: WordSection[];
    title?:   string;
    author?:  string;
}): Promise<DocumentResult> {
    try {
        ensureDocsDir();
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { Packer } = require('docx');

        const doc  = await buildDocxDocument(options.sections, { title: options.title, author: options.author });
        const buf  = await Packer.toBuffer(doc);
        const filename = safeName(options.filename.endsWith('.docx') ? options.filename : `${options.filename}.docx`);
        const filePath = path.join(DOCS_DIR, filename);
        fs.writeFileSync(filePath, buf);

        return { success: true, docxPath: filePath };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// â”€â”€â”€ PDF (pdf-lib) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Internal â€” map WordSection[] to a simple PDF using pdf-lib.
 * Produces a clean, readable PDF with proper text wrapping.
 */
async function buildPdfFromSections(sections: WordSection[]): Promise<Uint8Array> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PDFDocument, StandardFonts, rgb, PageSizes } = require('pdf-lib');

    const pdfDoc  = await PDFDocument.create();
    const font    = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontB   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontI   = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    const MARGIN    = 60;
    const PAGE_W    = 595.28; // A4
    const PAGE_H    = 841.89;
    const TEXT_W    = PAGE_W - MARGIN * 2;

    let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    let y    = PAGE_H - MARGIN;

    function ensureSpace(needed: number) {
        if (y - needed < MARGIN) {
            page = pdfDoc.addPage([PAGE_W, PAGE_H]);
            y    = PAGE_H - MARGIN;
        }
    }

    function hexToRgb(hex?: string) {
        if (!hex) return rgb(0, 0, 0);
        const clean = hex.replace('#', '');
        const r = parseInt(clean.slice(0, 2), 16) / 255;
        const g = parseInt(clean.slice(2, 4), 16) / 255;
        const b = parseInt(clean.slice(4, 6), 16) / 255;
        return rgb(r, g, b);
    }

    function drawWrappedText(text: string, opts: {
        usedFont: any;
        size: number;
        color?: string;
        lineGap?: number;
        indent?: number;
        align?: string;
    }) {
        const { usedFont, size, color, lineGap = 4, indent = 0 } = opts;
        const words = text.split(' ');
        let line = '';
        const lineHeight = size + lineGap;

        for (const word of words) {
            const test = line ? `${line} ${word}` : word;
            const w    = usedFont.widthOfTextAtSize(test, size);
            if (w > TEXT_W - indent && line) {
                ensureSpace(lineHeight);
                page.drawText(line, { x: MARGIN + indent, y, size, font: usedFont, color: hexToRgb(color) });
                y -= lineHeight;
                line = word;
            } else {
                line = test;
            }
        }
        if (line) {
            ensureSpace(lineHeight);
            page.drawText(line, { x: MARGIN + indent, y, size, font: usedFont, color: hexToRgb(color) });
            y -= lineHeight;
        }
    }

    for (const sec of sections) {
        switch (sec.type) {
            case 'heading': {
                const sizes: Record<number, number> = { 1: 20, 2: 16, 3: 14, 4: 12 };
                const sz    = sizes[sec.level ?? 1] ?? 20;
                const gap   = sec.level === 1 ? 16 : 10;
                y -= gap;
                ensureSpace(sz + 16);
                drawWrappedText(sec.text ?? '', { usedFont: fontB, size: sz, color: sec.color });
                y -= 6;
                break;
            }
            case 'paragraph': {
                const sz  = sec.fontSize ? sec.fontSize / 2 : 11;
                const f   = sec.bold ? fontB : sec.italic ? fontI : font;
                y -= 4;
                drawWrappedText(sec.text ?? '', { usedFont: f, size: sz, color: sec.color });
                y -= 4;
                break;
            }
            case 'bullet': {
                const items = sec.items ?? (sec.text ? [sec.text] : []);
                for (const item of items) {
                    y -= 2;
                    ensureSpace(14);
                    page.drawText('â€¢', { x: MARGIN, y, size: 11, font: fontB, color: rgb(0, 0, 0) });
                    drawWrappedText(item, { usedFont: font, size: 11, indent: 14 });
                }
                y -= 4;
                break;
            }
            case 'table': {
                const allRows: string[][] = [];
                if (sec.tableHeaders?.length) allRows.push(sec.tableHeaders);
                if (sec.tableRows?.length) allRows.push(...sec.tableRows);

                const cols  = allRows[0]?.length ?? 1;
                const colW  = TEXT_W / cols;
                const rowH  = 18;

                for (let ri = 0; ri < allRows.length; ri++) {
                    ensureSpace(rowH + 4);
                    const row     = allRows[ri];
                    const isHead  = ri === 0 && sec.tableHeaders?.length;
                    for (let ci = 0; ci < row.length; ci++) {
                        const cx  = MARGIN + ci * colW;
                        // Cell bg for header
                        if (isHead) {
                            page.drawRectangle({ x: cx, y: y - 2, width: colW, height: rowH, color: rgb(0.9, 0.9, 0.9) });
                        }
                        page.drawText(String(row[ci] ?? '').slice(0, 40), {
                            x: cx + 4, y: y + 3, size: 9,
                            font: isHead ? fontB : font,
                            color: rgb(0, 0, 0),
                            maxWidth: colW - 8,
                        });
                    }
                    y -= rowH;
                }
                y -= 8;
                break;
            }
            case 'divider': {
                y -= 6;
                ensureSpace(4);
                page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
                y -= 8;
                break;
            }
            case 'pageBreak': {
                page = pdfDoc.addPage([PAGE_W, PAGE_H]);
                y    = PAGE_H - MARGIN;
                break;
            }
        }
    }

    return pdfDoc.save();
}

/**
 * Generate a PDF from structured sections.
 * Returns the path to the saved .pdf file.
 */
export async function createPdfDocument(options: {
    filename: string;
    sections: WordSection[];
    title?:   string;
    author?:  string;
}): Promise<DocumentResult> {
    try {
        ensureDocsDir();
        const bytes    = await buildPdfFromSections(options.sections);
        const filename = safeName(options.filename.endsWith('.pdf') ? options.filename : `${options.filename}.pdf`);
        const filePath = path.join(DOCS_DIR, filename);
        fs.writeFileSync(filePath, bytes);
        return { success: true, pdfPath: filePath };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Generate BOTH a Word (.docx) AND a PDF (.pdf) from the same sections.
 * This is the primary function for document-creation requests (resume, reports, letters, etc.).
 */
export async function createDocument(options: {
    filename: string;
    sections: WordSection[];
    title?:   string;
    author?:  string;
}): Promise<DocumentResult> {
    ensureDocsDir();
    try {
        const [wordResult, pdfResult] = await Promise.all([
            createWordDocument(options),
            createPdfDocument({
                ...options,
                filename: options.filename.replace(/\.docx$/i, ''),
            }),
        ]);

        if (!wordResult.success && !pdfResult.success) {
            return { success: false, error: `Word: ${wordResult.error} | PDF: ${pdfResult.error}` };
        }

        return {
            success:  true,
            docxPath: wordResult.docxPath,
            pdfPath:  pdfResult.pdfPath,
        };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Merge multiple existing PDF files into a single PDF.
 */
export async function mergePdfs(options: {
    inputPaths: string[];
    outputFilename: string;
}): Promise<DocumentResult> {
    try {
        ensureDocsDir();
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { PDFDocument } = require('pdf-lib');

        const merged = await PDFDocument.create();
        for (const inputPath of options.inputPaths) {
            const bytes = fs.readFileSync(inputPath);
            const doc   = await PDFDocument.load(bytes);
            const pages = await merged.copyPages(doc, doc.getPageIndices());
            pages.forEach((p: any) => merged.addPage(p));
        }

        const filename = safeName(options.outputFilename.endsWith('.pdf')
            ? options.outputFilename
            : `${options.outputFilename}.pdf`);
        const filePath = path.join(DOCS_DIR, filename);
        const bytes    = await merged.save();
        fs.writeFileSync(filePath, bytes);

        return { success: true, pdfPath: filePath };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * List all documents in the documents directory.
 */
export async function listDocuments(): Promise<{
    success: boolean;
    files?: { name: string; path: string; size: number; modified: number; type: string }[];
    error?: string;
}> {
    try {
        ensureDocsDir();
        const entries = fs.readdirSync(DOCS_DIR, { withFileTypes: true });
        const files = entries
            .filter((e) => e.isFile())
            .map((e) => {
                const fp   = path.join(DOCS_DIR, e.name);
                const stat = fs.statSync(fp);
                const ext  = path.extname(e.name).toLowerCase().replace('.', '');
                return { name: e.name, path: fp, size: stat.size, modified: stat.mtimeMs, type: ext };
            })
            .sort((a, b) => b.modified - a.modified);

        return { success: true, files };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
