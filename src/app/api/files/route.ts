import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, readdir, unlink, stat, rename } from "fs/promises";
import { join } from "path";
import { FileType, UploadedFile } from "@/types/file";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/mnt/user-data/uploads";

async function ensureDir(dirPath: string) {
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
  }
}

async function getWorkingDir(typeDirName: string): Promise<string> {
  const primaryPath = join(UPLOAD_DIR, typeDirName);
  try {
    await ensureDir(primaryPath);
    return primaryPath;
  } catch {
    const fallbackPath = join(process.cwd(), ".next", "uploads", typeDirName);
    await ensureDir(fallbackPath);
    return fallbackPath;
  }
}

export async function GET(_req: NextRequest) {
  try {
    const types: FileType[] = ["image", "video", "audio", "presentation"];
    const allFiles: UploadedFile[] = [];

    for (const type of types) {
      const typeDirName = type === "presentation" ? "presentations" : type + "s";
      const typeDir = await getWorkingDir(typeDirName);

      try {
        const files = await readdir(typeDir);
        for (const file of files) {
          if (file.startsWith(".")) continue;
          const filePath = join(typeDir, file);
          const fileStat = await stat(filePath);

          const fileUrl = `/api/static?path=${encodeURIComponent(join(typeDir, file))}`;
          const cleanFileName = file.includes("-") ? file.substring(file.indexOf("-") + 1) : file;
          allFiles.push({
            id: `${type}-${file}`,
            type,
            fileName: cleanFileName,
            fileUrl,
            fileSize: fileStat.size,
            uploadedAt: fileStat.mtime.toISOString(),
            thumbnailUrl: (type === "image" || type === "video") ? fileUrl : "",
          });
        }
      } catch {
      }
    }

    allFiles.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    return NextResponse.json(allFiles);
  } catch (error: unknown) {
    console.error("GET Error:", error);
    return NextResponse.json({ error: (error as Error).message || "Failed to fetch files" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const type = formData.get("type") as FileType;

    if (!files || files.length === 0 || !type) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const typeDirName = type === "presentation" ? "presentations" : type + "s";
    const typeDir = await getWorkingDir(typeDirName);

    const uploadedRecords: UploadedFile[] = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      const filePath = join(typeDir, safeName);

      await writeFile(filePath, buffer);

      const fileUrl = `/api/static?path=${encodeURIComponent(filePath)}`;
      const cleanFileName = safeName.includes("-") ? safeName.substring(safeName.indexOf("-") + 1) : safeName;
      uploadedRecords.push({
        id: `${type}-${safeName}`,
        type,
        fileName: cleanFileName,
        fileUrl,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        thumbnailUrl: (type === "image" || type === "video") ? fileUrl : "",
      });
    }

    return NextResponse.json({ success: true, files: uploadedRecords });
  } catch (error: unknown) {
    console.error("POST Error:", error);
    return NextResponse.json({ error: (error as Error).message || "Upload failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const type = url.searchParams.get("type") as FileType;

    if (!id || !type) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const typeDirName = type === "presentation" ? "presentations" : type + "s";
    const typeDir = await getWorkingDir(typeDirName);

    // id is constructed as `${type}-${fileName}`
    const fileName = id.substring(type.length + 1);
    const filePath = join(typeDir, fileName);

    await unlink(filePath);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("DELETE Error:", error);
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ success: true, note: "File already deleted" });
    }
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, type, newName } = body as { id: string; type: FileType; newName: string };

    if (!id || !type || !newName) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const typeDirName = type === "presentation" ? "presentations" : type + "s";
    const typeDir = await getWorkingDir(typeDirName);

    const oldFileName = id.substring(type.length + 1);
    const oldFilePath = join(typeDir, oldFileName);

    // Check if new name already has an extension, if not, append the old one
    const extMatch = oldFileName.match(/\.[0-9a-z]+$/i);
    const oldExt = extMatch ? extMatch[0] : "";
    let finalNewName = newName;
    if (oldExt && !finalNewName.endsWith(oldExt)) {
      finalNewName += oldExt;
    }

    // Ensure safe name
    const timestamp = oldFileName.split("-")[0];
    const safeSegment = finalNewName.replace(/[^a-zA-Z0-9.\-_가-힣]/g, "_");
    const safeNewName = `${timestamp}-${safeSegment}`;

    const newFilePath = join(typeDir, safeNewName);

    await rename(oldFilePath, newFilePath);

    return NextResponse.json({ success: true, newId: `${type}-${safeNewName}`, newPath: newFilePath });
  } catch (error: unknown) {
    console.error("PATCH Error:", error);
    return NextResponse.json({ error: (error as Error).message || "Rename failed" }, { status: 500 });
  }
}
