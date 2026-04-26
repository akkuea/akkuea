import KYCForm from "@/components/kyc/KYCForm";
import { GridBackground } from "@/components/landing";

export default function Page() {
  return (
    <div className="noise-bg w-full h-full min-h-screen relative flex items-center justify-center py-20 px-[4%]  ">
      <GridBackground />
      <KYCForm />
    </div>
  );
}
