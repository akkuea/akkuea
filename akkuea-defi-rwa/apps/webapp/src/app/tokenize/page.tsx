'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileText,
  Building2,
  Coins,
  CheckCircle2,
  X,
  Link2,
  Image as ImageIcon,
  MapPin,
  DollarSign,
  Percent,
  Users,
  Shield,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Wallet,
} from 'lucide-react';
import { Navbar, Footer } from '@/components/layout';
import { Card, Button, Input, Textarea, Badge, Stepper } from '@/components/ui';
import { useWallet } from '@/context/WalletContext';
import { formatCurrency, cn } from '@/lib/utils';
import { pageTransition, fadeInUp, staggerContainer, staggerItem } from '@/lib/animations';

const steps = [
  { id: 'details', title: 'Property Details', description: 'Basic information' },
  { id: 'documents', title: 'Documents', description: 'Upload files' },
  { id: 'tokenization', title: 'Tokenization', description: 'Configure tokens' },
  { id: 'review', title: 'Review', description: 'Confirm & submit' },
];

interface FormData {
  // Step 1: Property Details
  name: string;
  description: string;
  address: string;
  city: string;
  country: string;
  propertyType: string;
  totalArea: string;
  bedrooms: string;
  bathrooms: string;
  yearBuilt: string;
  // Step 2: Documents
  titleDeed: File | null;
  propertyImages: File[];
  legalDocuments: File[];
  appraisalReport: File | null;
  // Step 3: Tokenization
  totalValue: string;
  totalTokens: string;
  tokenPrice: string;
  minInvestment: string;
  expectedYield: string;
  fundingDeadline: string;
}

const initialFormData: FormData = {
  name: '',
  description: '',
  address: '',
  city: '',
  country: '',
  propertyType: 'residential',
  totalArea: '',
  bedrooms: '',
  bathrooms: '',
  yearBuilt: '',
  titleDeed: null,
  propertyImages: [],
  legalDocuments: [],
  appraisalReport: null,
  totalValue: '',
  totalTokens: '',
  tokenPrice: '',
  minInvestment: '',
  expectedYield: '',
  fundingDeadline: '',
};

export default function TokenizePage() {
  const { isConnected, connect, isConnecting } = useWallet();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateFormData = useCallback((updates: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 3000));
    setIsSubmitting(false);
    // Show success state
  };

  // Calculate token price automatically
  const calculatedTokenPrice =
    formData.totalValue && formData.totalTokens
      ? parseFloat(formData.totalValue) / parseFloat(formData.totalTokens)
      : 0;

  if (!isConnected) {
    return (
      <motion.div
        variants={pageTransition}
        initial="initial"
        animate="animate"
        className="min-h-screen bg-black"
      >
        <Navbar />
        <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-center justify-center min-h-[60vh] text-center"
          >
            <div className="w-16 h-16 rounded-lg bg-[#1a1a1a] border border-[#262626] flex items-center justify-center mb-6">
              <Wallet className="w-8 h-8 text-neutral-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">Tokenize Your Property</h1>
            <p className="text-sm text-neutral-500 max-w-md mb-8">
              Connect your wallet to begin the property tokenization process. Turn your real estate
              into tradeable digital assets on the Stellar blockchain.
            </p>
            <Button
              size="lg"
              onClick={connect}
              isLoading={isConnecting}
              leftIcon={<Wallet className="w-4 h-4" />}
              isSecure
            >
              Connect Wallet
            </Button>
          </motion.div>
        </main>
        <Footer />
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={pageTransition}
      initial="initial"
      animate="animate"
      className="min-h-screen bg-black"
    >
      <Navbar />
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-8"
        >
          {/* Header */}
          <motion.div variants={staggerItem} className="text-center">
            <h1 className="text-2xl font-bold text-white">Tokenize Your Property</h1>
            <p className="text-sm text-neutral-500 mt-2">
              Transform your real estate into digital tokens in four simple steps
            </p>
          </motion.div>

          {/* Stepper */}
          <motion.div variants={staggerItem}>
            <Stepper steps={steps} currentStep={currentStep} />
          </motion.div>

          {/* Form Content */}
          <motion.div variants={staggerItem}>
            <Card className="relative overflow-hidden">
              <AnimatePresence mode="wait">
                {/* Step 1: Property Details */}
                {currentStep === 0 && (
                  <motion.div
                    key="step-1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-lg bg-[#ff3e00]/10 border border-[#ff3e00]/20 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-[#ff3e00]" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-white">Property Details</h2>
                        <p className="text-xs text-neutral-500">Basic information about your property</p>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <Input
                          label="Property Name"
                          placeholder="e.g., Luxury Apartments Lagos"
                          value={formData.name}
                          onChange={(e) => updateFormData({ name: e.target.value })}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Textarea
                          label="Description"
                          placeholder="Describe your property..."
                          rows={3}
                          value={formData.description}
                          onChange={(e) => updateFormData({ description: e.target.value })}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Input
                          label="Street Address"
                          placeholder="123 Main Street"
                          value={formData.address}
                          onChange={(e) => updateFormData({ address: e.target.value })}
                          leftIcon={<MapPin className="w-4 h-4" />}
                        />
                      </div>
                      <Input
                        label="City"
                        placeholder="Lagos"
                        value={formData.city}
                        onChange={(e) => updateFormData({ city: e.target.value })}
                      />
                      <div>
                        <label className="block text-xs font-medium text-neutral-400 mb-2 uppercase tracking-wider">
                          Country
                        </label>
                        <select
                          value={formData.country}
                          onChange={(e) => updateFormData({ country: e.target.value })}
                          className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#262626] rounded-lg text-white text-sm focus:outline-none focus:border-[#404040] cursor-pointer"
                        >
                          <option value="">Select country</option>
                          <option value="nigeria">Nigeria</option>
                          <option value="kenya">Kenya</option>
                          <option value="ghana">Ghana</option>
                          <option value="south-africa">South Africa</option>
                          <option value="mexico">Mexico</option>
                          <option value="colombia">Colombia</option>
                          <option value="brazil">Brazil</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-400 mb-2 uppercase tracking-wider">
                          Property Type
                        </label>
                        <select
                          value={formData.propertyType}
                          onChange={(e) => updateFormData({ propertyType: e.target.value })}
                          className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#262626] rounded-lg text-white text-sm focus:outline-none focus:border-[#404040] cursor-pointer"
                        >
                          <option value="residential">Residential</option>
                          <option value="commercial">Commercial</option>
                          <option value="industrial">Industrial</option>
                          <option value="mixed-use">Mixed Use</option>
                        </select>
                      </div>
                      <Input
                        label="Total Area (sq ft)"
                        type="number"
                        placeholder="5000"
                        value={formData.totalArea}
                        onChange={(e) => updateFormData({ totalArea: e.target.value })}
                      />
                      <Input
                        label="Bedrooms"
                        type="number"
                        placeholder="3"
                        value={formData.bedrooms}
                        onChange={(e) => updateFormData({ bedrooms: e.target.value })}
                      />
                      <Input
                        label="Bathrooms"
                        type="number"
                        placeholder="2"
                        value={formData.bathrooms}
                        onChange={(e) => updateFormData({ bathrooms: e.target.value })}
                      />
                      <Input
                        label="Year Built"
                        type="number"
                        placeholder="2020"
                        value={formData.yearBuilt}
                        onChange={(e) => updateFormData({ yearBuilt: e.target.value })}
                      />
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Documents */}
                {currentStep === 1 && (
                  <motion.div
                    key="step-2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-lg bg-[#ff3e00]/10 border border-[#ff3e00]/20 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-[#ff3e00]" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-white">Upload Documents</h2>
                        <p className="text-xs text-neutral-500">
                          Required documents for property verification
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Title Deed */}
                      <div className="p-4 border-2 border-dashed border-[#262626] rounded-lg hover:border-[#ff3e00]/50 transition-colors cursor-pointer">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#1a1a1a] border border-[#262626] flex items-center justify-center">
                              <FileText className="w-5 h-5 text-neutral-500" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white">Title Deed / Proof of Ownership</p>
                              <p className="text-xs text-neutral-600 font-mono">PDF or image, max 10MB</p>
                            </div>
                          </div>
                          {formData.titleDeed ? (
                            <Badge variant="success" dot>
                              Uploaded
                            </Badge>
                          ) : (
                            <Button variant="outline" size="sm" leftIcon={<Upload className="w-4 h-4" />}>
                              Upload
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Property Images */}
                      <div className="p-4 border-2 border-dashed border-[#262626] rounded-lg hover:border-[#ff3e00]/50 transition-colors cursor-pointer">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#1a1a1a] border border-[#262626] flex items-center justify-center">
                              <ImageIcon className="w-5 h-5 text-neutral-500" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white">Property Images</p>
                              <p className="text-xs text-neutral-600 font-mono">Min 5 images, max 20MB each</p>
                            </div>
                          </div>
                          <Badge variant="outline">{formData.propertyImages.length}/5 min</Badge>
                        </div>
                      </div>

                      {/* Legal Documents */}
                      <div className="p-4 border-2 border-dashed border-[#262626] rounded-lg hover:border-[#ff3e00]/50 transition-colors cursor-pointer">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#1a1a1a] border border-[#262626] flex items-center justify-center">
                              <Shield className="w-5 h-5 text-neutral-500" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white">Legal Documents</p>
                              <p className="text-xs text-neutral-600 font-mono">
                                Insurance, permits, compliance docs
                              </p>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" leftIcon={<Upload className="w-4 h-4" />}>
                            Upload
                          </Button>
                        </div>
                      </div>

                      {/* Appraisal Report */}
                      <div className="p-4 border-2 border-dashed border-[#262626] rounded-lg hover:border-[#ff3e00]/50 transition-colors cursor-pointer">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#1a1a1a] border border-[#262626] flex items-center justify-center">
                              <DollarSign className="w-5 h-5 text-neutral-500" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white">Appraisal Report (Optional)</p>
                              <p className="text-xs text-neutral-600 font-mono">Professional property valuation</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" leftIcon={<Upload className="w-4 h-4" />}>
                            Upload
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Link2 className="w-5 h-5 text-blue-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-white">Chainlink Oracle Integration</p>
                          <p className="text-xs text-neutral-500 mt-1">
                            Your property will be valued using Chainlink price feeds for accurate,
                            manipulation-resistant pricing data.
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Tokenization */}
                {currentStep === 2 && (
                  <motion.div
                    key="step-3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-lg bg-[#ff3e00]/10 border border-[#ff3e00]/20 flex items-center justify-center">
                        <Coins className="w-5 h-5 text-[#ff3e00]" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-white">Token Configuration</h2>
                        <p className="text-xs text-neutral-500">
                          Configure how your property will be fractionalized
                        </p>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <Input
                        label="Total Property Value (USD)"
                        type="number"
                        placeholder="1000000"
                        value={formData.totalValue}
                        onChange={(e) => updateFormData({ totalValue: e.target.value })}
                        leftIcon={<DollarSign className="w-4 h-4" />}
                      />
                      <Input
                        label="Total Tokens to Mint"
                        type="number"
                        placeholder="10000"
                        value={formData.totalTokens}
                        onChange={(e) => updateFormData({ totalTokens: e.target.value })}
                        leftIcon={<Coins className="w-4 h-4" />}
                      />
                      <div>
                        <label className="block text-xs font-medium text-neutral-400 mb-2 uppercase tracking-wider">
                          Price per Token
                        </label>
                        <div className="px-3 py-2.5 bg-[#0a0a0a] border border-[#262626] rounded-lg text-white font-mono text-sm">
                          {calculatedTokenPrice ? formatCurrency(calculatedTokenPrice) : '-'}
                        </div>
                        <p className="text-[10px] text-neutral-600 mt-1 font-mono">Auto-calculated</p>
                      </div>
                      <Input
                        label="Minimum Investment (Tokens)"
                        type="number"
                        placeholder="1"
                        value={formData.minInvestment}
                        onChange={(e) => updateFormData({ minInvestment: e.target.value })}
                        leftIcon={<Users className="w-4 h-4" />}
                      />
                      <Input
                        label="Expected Annual Yield (%)"
                        type="number"
                        placeholder="8.5"
                        value={formData.expectedYield}
                        onChange={(e) => updateFormData({ expectedYield: e.target.value })}
                        leftIcon={<Percent className="w-4 h-4" />}
                      />
                      <Input
                        label="Funding Deadline"
                        type="date"
                        value={formData.fundingDeadline}
                        onChange={(e) => updateFormData({ fundingDeadline: e.target.value })}
                      />
                    </div>

                    <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-white">Token Standards</p>
                          <p className="text-xs text-neutral-500 mt-1">
                            Tokens will be minted as Soroban assets on Stellar, compliant with
                            regulatory requirements. Each token represents fractional ownership.
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 4: Review */}
                {currentStep === 3 && (
                  <motion.div
                    key="step-4"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-lg bg-[#00ff88]/10 border border-[#00ff88]/20 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-[#00ff88]" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-white">Review & Submit</h2>
                        <p className="text-xs text-neutral-500">
                          Review your property details before submission
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Property Summary */}
                      <div className="p-4 bg-[#0a0a0a] border border-[#262626] rounded-lg">
                        <h3 className="text-sm font-medium text-white mb-3 uppercase tracking-wider">Property Details</h3>
                        <div className="grid sm:grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-neutral-500">Name:</span>
                            <span className="ml-2 text-white">{formData.name || '-'}</span>
                          </div>
                          <div>
                            <span className="text-neutral-500">Location:</span>
                            <span className="ml-2 text-white">
                              {formData.city && formData.country
                                ? `${formData.city}, ${formData.country}`
                                : '-'}
                            </span>
                          </div>
                          <div>
                            <span className="text-neutral-500">Type:</span>
                            <span className="ml-2 text-white capitalize">
                              {formData.propertyType || '-'}
                            </span>
                          </div>
                          <div>
                            <span className="text-neutral-500">Area:</span>
                            <span className="ml-2 text-white font-mono">
                              {formData.totalArea ? `${formData.totalArea} sq ft` : '-'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Tokenization Summary */}
                      <div className="p-4 bg-[#0a0a0a] border border-[#262626] rounded-lg">
                        <h3 className="text-sm font-medium text-white mb-3 uppercase tracking-wider">Tokenization</h3>
                        <div className="grid sm:grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-neutral-500">Total Value:</span>
                            <span className="ml-2 text-white font-mono">
                              {formData.totalValue ? formatCurrency(parseFloat(formData.totalValue)) : '-'}
                            </span>
                          </div>
                          <div>
                            <span className="text-neutral-500">Total Tokens:</span>
                            <span className="ml-2 text-white font-mono">
                              {formData.totalTokens ? parseInt(formData.totalTokens).toLocaleString() : '-'}
                            </span>
                          </div>
                          <div>
                            <span className="text-neutral-500">Token Price:</span>
                            <span className="ml-2 text-white font-mono">
                              {calculatedTokenPrice ? formatCurrency(calculatedTokenPrice) : '-'}
                            </span>
                          </div>
                          <div>
                            <span className="text-neutral-500">Expected Yield:</span>
                            <span className="ml-2 text-[#00ff88] font-mono">
                              {formData.expectedYield ? `${formData.expectedYield}% APY` : '-'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Fees */}
                      <div className="p-4 bg-[#0a0a0a] border border-[#262626] rounded-lg">
                        <h3 className="text-sm font-medium text-white mb-3 uppercase tracking-wider">Fees</h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-neutral-500">Platform Fee (2%)</span>
                            <span className="text-white font-mono">
                              {formData.totalValue
                                ? formatCurrency(parseFloat(formData.totalValue) * 0.02)
                                : '-'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-500">Token Minting</span>
                            <span className="text-white font-mono">$50</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-500">Oracle Integration</span>
                            <span className="text-white font-mono">$100</span>
                          </div>
                          <div className="border-t border-[#262626] pt-2 mt-2 flex justify-between font-medium">
                            <span className="text-white">Total Fees</span>
                            <span className="text-white font-mono">
                              {formData.totalValue
                                ? formatCurrency(parseFloat(formData.totalValue) * 0.02 + 150)
                                : '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-[#00ff88]/5 border border-[#00ff88]/20 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Shield className="w-5 h-5 text-[#00ff88] mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-white">Ready for Review</p>
                          <p className="text-xs text-neutral-500 mt-1">
                            After submission, our team will review your property documents and
                            verify ownership. This typically takes 3-5 business days.
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#262626]">
                <Button
                  variant="ghost"
                  onClick={prevStep}
                  disabled={currentStep === 0}
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                >
                  Back
                </Button>
                {currentStep < steps.length - 1 ? (
                  <Button onClick={nextStep} rightIcon={<ArrowRight className="w-4 h-4" />}>
                    Continue
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    isLoading={isSubmitting}
                    isSecure
                    rightIcon={<CheckCircle2 className="w-4 h-4" />}
                  >
                    Submit for Review
                  </Button>
                )}
              </div>
            </Card>
          </motion.div>
        </motion.div>
      </main>
      <Footer />
    </motion.div>
  );
}
