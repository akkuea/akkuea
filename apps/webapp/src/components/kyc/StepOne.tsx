import { Calendar, House, Mail, Phone, User } from "lucide-react";
import { Input } from "../ui";
import { useFormContext } from "react-hook-form";
import { KycFormData } from "@/schemas/kyc.schema";
import { FormSelect } from "../forms";

export default function StepOne() {
  const {
    register,
    formState: { errors },
  } = useFormContext<KycFormData>();

  return (
    <div className="flex flex-col gap-6 items-start w-full ">
      <h2 className="text-[#ff3e00] font-semibold text-lg md:text-xl  ">
        Personal Information
      </h2>

      <div className=" w-full grid grid-cols-1 md:grid-cols-2 place-items-center justify-center justify-items-center gap-7 ">
        <div className="w-full flex flex-col items-start gap-1">
          <h3 className="text-sm md:text-base font-medium">Full name</h3>
          <Input
            placeholder="Okeke Chinedu"
            leftIcon={<User className="w-3 h-3 " />}
            {...register("fullName")}
            error={errors.fullName?.message}
          />
        </div>

        <div className="w-full flex flex-col items-start gap-1">
          <h3 className="text-sm md:text-base font-medium">Email</h3>
          <Input
            placeholder="chiscookeke11@gmail.com"
            leftIcon={<Mail className="w-3 h-3 " />}
            {...register("email")}
            error={errors.email?.message}
          />
        </div>

        <div className="w-full flex flex-col items-start gap-1">
          <h3 className="text-sm md:text-base font-medium  ">Date of Birth</h3>
          <Input
            type="date"
            leftIcon={<Calendar className="w-3 h-3 " />}
            {...register("date_of_birth")}
            error={errors.date_of_birth?.message}
            className="text-white  scheme-dark"
          />
        </div>

        <div className="w-full flex flex-col items-start gap-1">
          <h3 className="text-sm md:text-base font-medium">Nationality</h3>
          <FormSelect {...register("nationality")}>
            <option value="">Select country</option>
            <option value="nigeria">Nigeria</option>
            <option value="kenya">Kenya</option>
            <option value="ghana">Ghana</option>
            <option value="south-africa">South Africa</option>
            <option value="mexico">Mexico</option>
            <option value="colombia">Colombia</option>
            <option value="brazil">Brazil</option>
          </FormSelect>
        </div>

        <div className="w-full flex flex-col items-start gap-1">
          <h3 className="text-sm md:text-base font-medium">Phone Number</h3>
          <Input
            type="tel"
            inputMode="numeric"
            pattern="[0-9+]*"
            placeholder="+ 234 9074 8433"
            leftIcon={<Phone className="w-3 h-3 " />}
            {...register("phone_number")}
            error={errors.phone_number?.message}
          />
        </div>

        <div className="w-full flex flex-col items-start gap-1">
          <h3 className="text-sm md:text-base font-medium">
            Residential Address
          </h3>
          <Input
            type="text"
            placeholder="Enter your full residential address"
            leftIcon={<House className="w-3 h-3 " />}
            {...register("residential_address")}
            error={errors.residential_address?.message}
          />
        </div>
      </div>
    </div>
  );
}
