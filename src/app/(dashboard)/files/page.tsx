"use client";

import { useEffect, useState } from "react";
import FileUploadSection from "@/components/file/FileUploadSection";
import { useFiles } from "@/hooks/useFiles";
import { useFileUpload } from "@/hooks/useFileUpload";
import { getAcceptedFormats } from "@/lib/fileHelpers";
import { UploadedFile } from "@/types/file";
import FileContextMenu from "@/components/file/FileContextMenu";
import PreviewModal from "@/components/file/PreviewModal";
import InputModal from "@/components/common/InputModal";
import ConfirmModal from "@/components/common/ConfirmModal";
import { Pencil } from "lucide-react";

export default function FilesPage() {
  const { files, fetchFiles, deleteFile, renameFile } = useFiles();
  const { upload, isUploading } = useFileUpload();

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file: UploadedFile | null;
  } | null>(null);

  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);
  const [renameFileState, setRenameFileState] = useState<UploadedFile | null>(null);
  const [deleteFileState, setDeleteFileState] = useState<UploadedFile | null>(null);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleUpload = async (fileList: FileList, type: 'image' | 'video' | 'audio' | 'presentation') => {
    await upload(fileList, type);
    fetchFiles();
  };

  const handleContextMenu = (e: React.MouseEvent, file: UploadedFile) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleDeleteRequest = (file: UploadedFile) => {
    setDeleteFileState(file);
    closeContextMenu();
  };

  const handleConfirmDelete = async () => {
    if (deleteFileState) {
      await deleteFile(deleteFileState.id, deleteFileState.type);
      setDeleteFileState(null);
    }
  };

  const handleRenameConfirm = async (newName: string) => {
    if (renameFileState) {
      await renameFile(renameFileState.id, renameFileState.type, newName);
    }
  };

  return (
    <div className="flex flex-col gap-16 h-full pb-10">
      <FileUploadSection
        title="이미지"
        files={files.image}
        displayType="grid"
        acceptedFormats={getAcceptedFormats("image")}
        onUpload={(fl) => handleUpload(fl, "image")}
        onSelectFile={handleContextMenu}
        isUploading={isUploading}
      />

      <FileUploadSection
        title="동영상"
        files={files.video}
        displayType="grid"
        acceptedFormats={getAcceptedFormats("video")}
        onUpload={(fl) => handleUpload(fl, "video")}
        onSelectFile={handleContextMenu}
        isUploading={isUploading}
      />

      <FileUploadSection
        title="음원"
        files={files.audio}
        displayType="chips"
        acceptedFormats={getAcceptedFormats("audio")}
        onUpload={(fl) => handleUpload(fl, "audio")}
        onSelectFile={handleContextMenu}
        isUploading={isUploading}
      />

      <FileUploadSection
        title="프리젠테이션"
        files={files.presentation}
        displayType="grid"
        acceptedFormats={getAcceptedFormats("presentation")}
        onUpload={(fl) => handleUpload(fl, "presentation")}
        onSelectFile={handleContextMenu}
        isUploading={isUploading}
      />

      {contextMenu && contextMenu.file && (
        <FileContextMenu
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={closeContextMenu}
          onPreview={() => {
            setPreviewFile(contextMenu.file);
            closeContextMenu();
          }}
          onRename={() => {
            setRenameFileState(contextMenu.file);
            closeContextMenu();
          }}
          onDelete={() => handleDeleteRequest(contextMenu.file!)}
        />
      )}

      {previewFile && (
        <PreviewModal
          isOpen={!!previewFile}
          onClose={() => setPreviewFile(null)}
          fileUrl={previewFile.fileUrl}
          type={previewFile.type}
          fileName={previewFile.fileName}
        />
      )}

      {renameFileState && (
        <InputModal
          isOpen={!!renameFileState}
          onClose={() => setRenameFileState(null)}
          title="파일 이름 수정"
          placeholder="새 파일 이름을 입력하세요"
          icon={<Pencil size={18} className="text-red-500" />}
          initialValue={renameFileState.fileName}
          onConfirm={handleRenameConfirm}
          confirmText="수정"
        />
      )}

      {deleteFileState && (
        <ConfirmModal
          isOpen={!!deleteFileState}
          onClose={() => setDeleteFileState(null)}
          onConfirm={handleConfirmDelete}
          title="파일 삭제"
          message={`'${deleteFileState.fileName}' 파일을 정말 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`}
          confirmText="삭제"
          cancelText="취소"
          isDestructive={true}
        />
      )}
    </div>
  );
}
