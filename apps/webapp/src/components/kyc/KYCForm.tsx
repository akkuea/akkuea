"use client";

import { useEffect, useState } from "react";
import { Button } from "../ui";
import StepOne from "./StepOne";
import StepTwo from "./StepTwo";
import StepThree from "./StepThree";
import StepFour from "./StepFour";
import { FormProvider, useForm } from "react-hook-form";
import { KycFormData, kycSchema } from "@/schemas/kyc.schema";
import { zodResolver } from "@hookform/resolvers/zod";

export default function KYCForm() {
  const FORM_STORAGE_KEY = "kyc_form";
  const [currentStep, setCurrentStep] = useState(1);
  const [stepError, setStepError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const methods = useForm<KycFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(kycSchema as any),
    mode: "onBlur",
  });

  const { handleSubmit, watch, reset, trigger, getValues } = methods;

  // load saved component on mount
  useEffect(() => {
    const saved = localStorage.getItem(FORM_STORAGE_KEY);

    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);

      if (parsed.formValues) {
        reset(parsed.formValues);
      }

      if (typeof parsed.currentStep === "number") {
        setCurrentStep(parsed.currentStep);
      }
    } catch {
      console.error("Invalid form data");
    }
  }, [reset]);

  // Auto-save form changes
  useEffect(() => {
    const subscription = watch((value) => {
      const payload = {
        formValues: value,
        currentStep,
      };

      localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(payload));
    });

    return () => subscription.unsubscribe();
  }, [watch, currentStep]);

  // Function to go to to the next page
  const handleNext = async () => {
    if (currentStep === 4) return;

    // Validate Step One fields
    if (currentStep === 1) {
      const isValid = await trigger([
        "fullName",
        "email",
        "date_of_birth",
        "nationality",
        "phone_number",
        "residential_address",
      ]);

      if (!isValid) {
        setStepError("Please fill in all the fields before you proceed");
        return;
      }
    }

    // STEP 2 VALIDATION
    if (currentStep === 2) {
      const values = getValues();

      const hasNationalId = values.nationalId?.length;
      const hasSelfie = values.selfie?.length;

      if (!hasNationalId || !hasSelfie) {
        setStepError(
          "Please upload both National ID and Selfie before proceeding",
        );
        return;
      }
    }

    setCurrentStep((prev) => prev + 1);
    setStepError(null);
  };

  // function to go to the prev step of the form
  const handlePrev = () => {
    if (currentStep === 1) return;

    setCurrentStep((prev) => prev - 1);
  };

  const onSubmit = async (data: KycFormData) => {
    try {
      setIsSubmitting(true);

      console.log("Submitting data:", data);

      //send to API
      const formData = new FormData();

      // Append text fields
      formData.append("fullName", data.fullName);
      formData.append("email", data.email);
      formData.append("date_of_birth", data.date_of_birth);
      formData.append("nationality", data.nationality);
      formData.append("phone_number", data.phone_number);
      formData.append("residential_address", data.residential_address);

      // Append files
      if (data.nationalId?.[0]) {
        formData.append("nationalId", data.nationalId[0]);
      }

      if (data.selfie?.[0]) {
        formData.append("selfie", data.selfie[0]);
      }

      await fetch("/api/kyc", {
        method: "POST",
        body: formData,
      });

      localStorage.removeItem(FORM_STORAGE_KEY);

      reset();
      setCurrentStep(4);
      setIsSubmitted(true);
    } catch (error) {
      console.error("Submission failed", error);
      setStepError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full bg-white max-w-5xl z-10 flex flex-col gap-16 items-center font-mono py-10 px-7 rounded-xl "
      >
        <h1 className="text-xl md:text-3xl text-[#0a0a0a] font-semibold ">
          KYC Verification
        </h1>

        <div className="w-full grid grid-cols-2 lg:grid-cols-4 gap-3 place-items-center justify-items-center justify-center  ">
          <div className="w-full h-full flex flex-col items-start justify-end gap-2 text-[#0a0a0a] text-xs md:base ">
            Personal Information
            <span className="w-[90%] bg-[#ff3e00] h-1 block rounded-l-2xl " />
          </div>

          <div className="w-full h-full flex flex-col items-start justify-end gap-2 text-[#0a0a0a] text-xs md:base  ">
            Documents
            <span
              className={`${currentStep > 1 ? "w-[90%] " : "w-0"} bg-[#ff3e00] h-1 block rounded-l-2xl duration-300 ease-in-out transition-all `}
            />
          </div>

          <div className="w-full h-full flex flex-col items-start justify-end gap-2 text-[#0a0a0a]  text-xs md:text-base ">
            Review
            <span
              className={`${currentStep > 2 ? "w-[90%]" : "w-0"} bg-[#ff3e00] h-1 block rounded-l-2xl duration-300 ease-in-out transition-all `}
            />
          </div>

          <div className="w-full h-full flex flex-col items-start justify-end gap-2 text-[#0a0a0a] text-xs md:text-base ">
            Submit
            <span
              className={`${currentStep > 3 ? "w-[90%]" : "w-0"} bg-[#ff3e00] h-1 block rounded-l-2xl duration-300 ease-in-out transition-all `}
            />
          </div>
        </div>

        <div className="w-full text-[#0a0a0a] flex flex-col gap-10 items-start ">
          {currentStep === 1 && <StepOne />}
          {currentStep === 2 && <StepTwo />}
          {currentStep === 3 && <StepThree />}
          {currentStep === 4 && <StepFour isSubmitted={isSubmitted} />}

          <div className="w-full flex items-center justify-start gap-8  ">
            {currentStep !== 1 && (
              <Button
                onClick={handlePrev}
                type="button"
                className=" bg-[#ff3e00]! text-white! font-medium! text-base md:text-lg! "
              >
                Prev
              </Button>
            )}

            {currentStep !== 4 && (
              <Button
                onClick={handleNext}
                type="button"
                className=" bg-[#ff3e00]! text-white! font-medium! text-base md:text-lg! "
              >
                Next
              </Button>
            )}

            {currentStep === 4 && (
              <Button
                disabled={isSubmitting}
                type="submit"
                className=" bg-[#ff3e00]! text-white! font-medium! text-base md:text-lg! "
              >
                {" "}
                {isSubmitting ? "Submitting..." : "Submit"}
              </Button>
            )}

            {stepError && (
              <p className="ml-auto text-xs text-red-600 ">{stepError}</p>
            )}
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
