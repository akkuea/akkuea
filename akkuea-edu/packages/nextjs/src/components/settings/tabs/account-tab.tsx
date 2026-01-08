'use client';

import { LogOutIcon, RefreshCcw, User, WalletIcon, CheckCircle2 } from 'lucide-react';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
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
    <div className="bg-card rounded-xl p-4 sm:p-6 mb-6 shadow-sm border border-border">
      <div className="mb-4 xl:mb-7">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-primary">
            <User className="w-5 h-5" aria-hidden="true" />
          </span>
          <h2 className="text-lg xl:text-2xl font-semibold">Account Information</h2>
        </div>
        <p className="text-sm text-muted mb-4">Manage your account details</p>
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
              className="bg-card border-border rounded-r-none"
            />
            <Button
              type="button"
              onClick={onVerifyEmail}
              disabled={isEmailVerified}
              aria-disabled={isEmailVerified}
              className="bg-transparent border-border h-9 border text-foreground rounded-l-none shadow-none"
              aria-label={isEmailVerified ? 'Email already verified' : 'Verify email'}
            >
              Verify
            </Button>
            {isEmailVerified && (
              <span
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-full border ml-2 bg-primary/10 text-primary border-primary/20"
                role="status"
                aria-live="polite"
              >
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                Verified
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
            className="bg-card border-border"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4 mt-12">
          <span className="text-primary">
            <WalletIcon className="w-5 h-5" />
          </span>
          <h2 className="font-medium">Connected Wallet</h2>
        </div>
        <div className="flex lg:items-center gap-2 mb-4 border-border bg-transparent border rounded-lg p-4 justify-between max-lg:flex-col max-lg:gap-8">
          <div>
            <p className="flex items-center gap-2">
              <span>{formatAddress('GDUKIJniuhuh1701291vbu98uZNY')}</span>
              <span className="text-xs bg-primary/10 text-primary border-primary/20 block px-2.5 py-1 rounded-full border">
                Stellar Testnet
              </span>
            </p>
            <p className="text-xs text-muted">Stellar wallet connected successfully</p>
          </div>
          <div className="flex gap-2 items-center">
            <Button variant="outline" className="bg-transparent border border-border">
              <RefreshCcw />
              Change Wallet
            </Button>
            <Button variant="destructive" className="bg-destructive hover:bg-destructive/80">
              <LogOutIcon />
              Disconnect
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
