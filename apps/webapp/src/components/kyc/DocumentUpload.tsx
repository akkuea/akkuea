"use client";

import { KycFormData } from "@/schemas/kyc.schema";
import { useState, DragEvent, ChangeEvent } from "react";
import { useFormContext } from "react-hook-form";

type DocumentUploadProps = {
  label?: string;
  accept?: string;
  multiple?: boolean;
  onFilesChange?: (files: File[]) => void;
};

export default function DocumentUpload({
  label,
  accept,
  multiple = false,
  onFilesChange,
}: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{
    [key: string]: number;
  }>({});
  useFormContext<KycFormData>();
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const [fileError, setFileError] = useState<string | null>(null);

  // upload function
  const uploadFile = (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();

    xhr.open("POST", "/api/upload"); // backend route

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);

        setUploadProgress((prev) => ({
          ...prev,
          [file.name]: percent,
        }));
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        console.log(`${file.name} uploaded successfully`);
      } else {
        console.error(`${file.name} upload failed`);
      }
    };

    xhr.send(formData);
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;

    const selectedFiles = Array.from(fileList);

    // Check file sizes
    for (const file of selectedFiles) {
      if (file.size > MAX_FILE_SIZE) {
        setFileError(
          `${file.name} exceeds 10MB. Maximum allowed size is 10MB.`,
        );
        return; // stop everything
      }
    }

    // If all files are valid
    setFileError(null);
    setFiles(selectedFiles);
    onFilesChange?.(selectedFiles);

    // Start uploading each file
    selectedFiles.forEach((file) => uploadFile(file));
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  return (
    <div className="w-full">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition cursor-pointer ${
          isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300"
        }`}
      >
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          id={label}
          onChange={handleChange}
        />
        <label
          htmlFor={label}
          className="cursor-pointer flex flex-col gap-2 text-xs "
        >
          {label}
          <span>Or</span>
          <span> Drag and Drop file here</span>
        </label>
      </div>

      {files.length > 0 && (
        <div className="mt-3 space-y-4 text-sm">
          {files.map((file, index) => (
            <div key={index} className="p-2 bg-gray-50 rounded border">
              <div className="flex justify-between text-xs mb-4">
                <span>
                  {file.name} {(file.size / (1024 * 1024)).toFixed(2)} MB
                </span>
                <span>{uploadProgress[file.name] || 0}%</span>
              </div>

              <div className="w-full bg-gray-200 rounded h-2">
                <div
                  className=" bg-[#ff3e00] h-2 rounded transition-all duration-300"
                  style={{
                    width: `${uploadProgress[file.name] || 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {fileError && <p className="mt-2 text-xs text-red-600">{fileError}</p>}
    </div>
  );
}
