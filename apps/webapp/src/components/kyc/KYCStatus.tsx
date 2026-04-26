"use client";

type KYCStatusProps = {
  status: "pending" | "approved" | "rejected";
};

export default function KYCStatus({ status }: KYCStatusProps) {
  let message = "";
  let color = "";

  switch (status) {
    case "pending":
      message = "Verification Pending";
      color = "text-yellow-500";
      break;
    case "approved":
      message = "KYC Approved";
      color = "text-green-600";
      break;
    case "rejected":
      message = "KYC Rejected";
      color = "text-red-600";
      break;
    default:
      message = "Unknown Status";
      color = "text-gray-500";
  }

  return (
    <div
      className={`p-4 border rounded-md w-full max-w-md ${color} border-gray-200 bg-gray-50`}
    >
      <p className="font-semibold text-center">{message}</p>
    </div>
  );
}
