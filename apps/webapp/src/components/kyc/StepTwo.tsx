"use client";
import { useFormContext } from "react-hook-form";
import { KycFormData } from "@/schemas/kyc.schema";
import DocumentUpload from "./DocumentUpload";

export default function StepTwo() {
  const { setValue } = useFormContext<KycFormData>();

  return (
    <div className="flex flex-col gap-6 items-start  w-full">
      <h2 className="text-[#ff3e00] font-semibold text-xl md:text-2xl  ">
        Upload Documents
      </h2>

      <div className=" w-full grid grid-cols- md:grid-cols-2  place-items-center justify-center justify-items-center gap-7 ">
        <DocumentUpload
          label="Click to upload National ID card"
          accept="image/*"
          multiple={false}
          onFilesChange={(files: File[]) => setValue("nationalId", files)}
        />

        <DocumentUpload
          label="Click to upload selfie"
          accept=".pdf,.doc,.docx"
          multiple={false}
          onFilesChange={(files: File[]) => setValue("selfie", files)}
        />
      </div>
    </div>
  );
}
