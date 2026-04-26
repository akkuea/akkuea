import KYCStatus from "./KYCStatus";

type StepFourProps = {
  isSubmitted: boolean;
};

export default function StepFour({ isSubmitted }: StepFourProps) {
  return (
    <div className="w-full flex flex-col items-center gap-4 text-center">
      <h2 className="text-[#ff3e00] font-semibold text-lg md:text-xl">
        Final Confirmation
      </h2>

      {!isSubmitted ? (
        <>
          <p className="text-[#0a0a0a] text-xs md:text-sm">
            Almost there! Everything looks great. Are you ready to submit your
            KYC information securely?
          </p>

          <p className="text-[#0a0a0a]  text-xs md:text-sm">
            Make sure all your details are correct before hitting “Submit”.
          </p>
        </>
      ) : (
        <KYCStatus status="pending" />
      )}
    </div>
  );
}
