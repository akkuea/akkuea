import { LogOutIcon, RefreshCcw, User, WalletIcon, CheckCircle2 } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { formatAddress } from '@/lib/utils';

/**
 * Props for the AccountTab component.
 * @example
 * <AccountTab
 *   email="user@example.com"
 *   isEmailVerified={false}
 *   username="myuser"
 *   onVerifyEmail={() => {}}
 * />
 */
export interface AccountTabProps {
  email: string;
  isEmailVerified: boolean;
  username: string;
  onVerifyEmail: () => void;
}

export function AccountTab({ email, isEmailVerified, username, onVerifyEmail }: AccountTabProps) {
  return (
    <div className="bg-white dark:bg-[#1F2937] rounded-xl p-4 sm:p-6 mb-6 shadow-sm border border-[#E5E7EB]">
      <div className="mb-4 xl:mb-7">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[#00CED1] dark:text-teal-400">
            <User className="w-5 h-5" aria-hidden="true" />
          </span>
          <h2 className="text-lg xl:text-2xl font-semibold ">Account Information</h2>
        </div>
        <p className="text-sm text-[#71717A] dark:text-white mb-4">Manage your account details</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <label htmlFor="email" className="block font-medium mb-1">
            Email Address
          </label>
          <div className="flex items-center">
            <Input
              type="email"
              id="email"
              value={email}
              readOnly
              aria-readonly="true"
              aria-label="Email address"
              className="bg-white dark:bg-[#1F2937] border-[#E4E4E7] dark:border-white rounded-r-none"
            />
            <Button
              type="button"
              onClick={onVerifyEmail}
              disabled={isEmailVerified}
              aria-disabled={isEmailVerified}
              className="bg-transparent border-[#D1D5DB] h-9 border dark:border-[#374151] text-[#111827] dark:text-white rounded-l-none shadow-none
              "
              aria-label={isEmailVerified ? 'Email already verified' : 'Verify email'}
            >
              Verify
            </Button>
            {isEmailVerified && (
              <span
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border ml-2 ${
                  isEmailVerified
                    ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/20 dark:text-green-400 dark:border-green-700'
                    : 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-700'
                }`}
                role="status"
                aria-live="polite"
              >
                <>
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  Verified
                </>
              </span>
            )}
          </div>
        </div>
        <div>
          <label htmlFor="username" className="block font-medium mb-1">
            Username
          </label>
          <Input
            type="text"
            id="username"
            value={username}
            readOnly
            aria-readonly="true"
            aria-label="Username"
            className="bg-white dark:bg-[#1F2937] border-[#E4E4E7] dark:border-white"
          />
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-4 mt-12">
          <span className="text-[#00CED1] dark:text-teal-400">
            <WalletIcon className="w-5 h-5" />
          </span>
          <h2 className="font-medium">Connected Wallet</h2>
        </div>
        <div className="flex lg:items-center gap-2 mb-4 border-[#E5E7EB] dark:border-[#374151] bg-transparent border rounded-lg p-4 justify-between max-lg:flex-col max-lg:gap-8">
          <div>
            <p className="flex items-center gap-2">
              <span>{formatAddress('GDUKIJniuhuh1701291vbu98uZNY')}</span>
              <span className="text-xs bg-[#EFF6FF] dark:bg-[#1E3A8A33] text-[#1D4ED8] border-[#BFDBFE] dark:text-[#60A5FA] dark:border-[#60A5FA] block px-2.5 py-1 rounded-full border">
                Stellar Testnet
              </span>
            </p>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              Stellar wallet connected successfully
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <Button variant="outline" className="bg-transparent border border-[#D1D5DB]">
              <RefreshCcw />
              Change Wallet
            </Button>
            <Button
              variant="destructive"
              className="bg-[#EF4444] hover:bg-[#DC2626]/80 dark:bg-transparent dark:hover:bg-[#DC2626]"
            >
              <LogOutIcon />
              Disconnect
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
