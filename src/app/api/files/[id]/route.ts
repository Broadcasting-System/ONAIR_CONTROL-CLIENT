import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { join } from "path";
import { FileType } from "@/types/file";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/mnt/user-data/uploads";

async function getTypeDir(type: FileType): Promise<string> {
  const typeDirName = type === "presentation" ? "presentations" : type + "s";
  return join(UPLOAD_DIR, typeDirName);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const dashIdx = id.indexOf("-");
    if (dashIdx === -1) {
      return NextResponse.json({ error: "Invalid file id format" }, { status: 400 });
    }

    const type = id.substring(0, dashIdx) as FileType;
    const fileName = id.substring(dashIdx + 1);
    const typeDir = await getTypeDir(type);
    const filePath = join(typeDir, fileName);

    await unlink(filePath);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ success: true, note: "File already deleted" });
    }
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
