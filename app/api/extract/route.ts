import { MAX_FILE_BYTES } from "@/lib/attachments";

export const runtime = "nodejs";

// Turns an uploaded PDF or DOCX into plain text. Nothing is stored.
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return new Response("No file uploaded", { status: 400 });
  if (file.size > MAX_FILE_BYTES) return new Response("File too large", { status: 413 });
  const name = file.name.toLowerCase();
  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    if (name.endsWith(".pdf")) {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(bytes);
      const { text, totalPages } = await extractText(pdf, { mergePages: false });
      const pages = (text as string[]).map((t, i) => `--- Page ${i + 1} ---\n${t.trim()}`);
      return Response.json({ text: pages.join("\n\n"), pages: totalPages });
    }
    if (name.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      return Response.json({ text: value });
    }
  } catch (err) {
    return new Response(`Couldn't read ${file.name}: ${(err as Error).message.slice(0, 120)}`, { status: 422 });
  }
  return new Response("Only PDF and DOCX are extracted on the server", { status: 415 });
}
