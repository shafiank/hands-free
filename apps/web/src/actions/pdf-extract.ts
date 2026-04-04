'use server';

import { DATA_DIR } from '@/lib/paths';
import { Buffer } from 'buffer';
import fs from 'fs';
import path from 'path';

export async function extractPdfText(base64orBuffer: string | Buffer): Promise<{ success: boolean; text?: string; error?: string }> {
    try {
        let buffer: Buffer;

        if (Buffer.isBuffer(base64orBuffer)) {
            buffer = base64orBuffer;
        } else {
            // Check if it's a data URI format and strip the header
            const b64Str = base64orBuffer.includes(',') ? base64orBuffer.split(',')[1] : base64orBuffer;
            buffer = Buffer.from(b64Str, 'base64');
        }

        // Dynamic import with webpackIgnore so webpack skips static resolution entirely.
        // The require() fallback was removed â€” it caused webpack to throw "Module not found"
        // at build time even when the package is installed, because webpack resolves all
        // require() calls statically regardless of try/catch.
        let pdfParse;
        try {
            pdfParse = (await import(/* webpackIgnore: true */ 'pdf-parse')).default;
        } catch {
            return {
                success: false,
                error: 'PDF text extraction is unavailable (pdf-parse library missing). ' +
                    'Workaround: I can save the PDF to your Workspace folder so you can open it directly, or you can copy-paste the text content here for analysis.',
            };
        }

        const data = await pdfParse(buffer, { max: 20 }); // limit to first 20 pages for large PDFs
        const text = data?.text?.trim() || '';
        const pageCount = data?.numpages || 0;

        if (!text) {
            return {
                success: false,
                error: pageCount > 0
                    ? `PDF has ${pageCount} page(s) but contains no extractable text â€” it may be a scanned document or image-only PDF. Workaround: use OCR software, or copy-paste the text content directly into the chat.`
                    : 'PDF appears to be empty or contains only images (scanned document without OCR).',
            };
        }

        // Return up to 30,000 characters to prevent overloading the LLM context window
        const truncated = text.length > 30000;
        return {
            success: true,
            text: truncated
                ? text.slice(0, 30000) + `\n\n[...PDF TRUNCATED at 30,000 chars â€” ${pageCount} total pages. Ask me to focus on a specific section if needed.]`
                : text,
        };

    } catch (e: any) {
        console.error('[pdf-extract] PDF reading failed:', e);
        return {
            success: false,
            error: `Failed to process PDF: ${e.message || String(e)}. ` +
                'Workaround: I can save the PDF to your Workspace so you can open it directly, or share the text content here.',
        };
    }
}

/**
 * Save a raw PDF (as base64 data URI or plain base64) to the workspace uploads folder.
 * Returns the relative path inside the workspace so Hands Free can reference it.
 */
export async function savePdfToWorkspace(
    base64orDataUri: string,
    filename: string
): Promise<{ success: boolean; relativePath?: string; error?: string }> {
    try {
        const b64Str = base64orDataUri.includes(',') ? base64orDataUri.split(',')[1] : base64orDataUri;
        const buffer = Buffer.from(b64Str, 'base64');

        // Save to <cwd>/.handsfree-data/workspace/files/uploads/
        const uploadsDir = path.join(DATA_DIR, 'workspace', 'files', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Sanitize filename â€” strip path separators
        const safeName = path.basename(filename).replace(/[<>:"/\\|?*]/g, '_');
        const savePath = path.join(uploadsDir, safeName);
        fs.writeFileSync(savePath, buffer);

        return { success: true, relativePath: `files/uploads/${safeName}` };
    } catch (e: any) {
        return { success: false, error: e.message || String(e) };
    }
}
