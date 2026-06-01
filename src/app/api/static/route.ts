import { NextRequest, NextResponse } from "next/server";
import { stat } from "fs/promises";
import { createReadStream } from "fs";
import { join } from "path";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const filePath = url.searchParams.get("path");

    if (!filePath) {
      return new NextResponse("Not Found", { status: 404 });
    }

    let resolvedPath = filePath;
    let fileStat;
    try {
      fileStat = await stat(resolvedPath);
    } catch {
      resolvedPath = join(process.cwd(), ".next", "uploads", filePath.split("uploads/")[1] || filePath);
      fileStat = await stat(resolvedPath);
    }

    if (!fileStat.isFile()) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const ext = resolvedPath.split('.').pop()?.toLowerCase();
    let contentType = "application/octet-stream";
    if (ext === "jpg" || ext === "jpeg") contentType = "image/jpeg";
    if (ext === "png") contentType = "image/png";
    if (ext === "gif") contentType = "image/gif";
    if (ext === "mp4") contentType = "video/mp4";
    if (ext === "webm") contentType = "video/webm";
    if (ext === "mp3") contentType = "audio/mpeg";

    const fileSize = fileStat.size;
    const range = req.headers.get("range");

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize) {
        return new NextResponse("Requested range not satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${fileSize}` },
        });
      }

      const chunksize = end - start + 1;
      const fileStream = createReadStream(resolvedPath, { start, end });

      // @ts-expect-error NextResponse can accept a stream
      return new NextResponse(fileStream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize.toString(),
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    const fileStream = createReadStream(resolvedPath);

    // @ts-expect-error NextResponse can accept a stream
    return new NextResponse(fileStream, {
      headers: {
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Content-Length": fileSize.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Static File Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
