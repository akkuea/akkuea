import type React from 'react';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  Code,
  Eye,
  FileJson,
  FileText,
  GitBranchPlus,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import ReactToolTip from 'react-tooltip'; // <-- import at the top

export default function Home() {
  return (
    <div className="relative">
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden -z-10">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"></div>

        {/* Decorative elements */}
        <div className="absolute top-10 right-10 w-64 h-64 bg-gradient-to-br from-purple-300/20 to-pink-300/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-40 left-20 w-80 h-80 bg-gradient-to-tr from-blue-300/20 to-cyan-300/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-gradient-to-r from-green-300/10 to-teal-300/10 rounded-full blur-3xl"></div>

        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[url('/placeholder.svg?height=20&width=20')] bg-[length:50px_50px] opacity-[0.03] dark:opacity-[0.02]"></div>
      </div>

      <div className="relative">
        {/* Hero Section */}
        <section className="relative pt-24 pb-16 overflow-hidden">
          <div className="container mx-auto px-4">
            <div className="relative z-10 max-w-5xl mx-auto">
              <div className="absolute -top-32 -left-32 w-64 h-64 bg-[#7CC635]/10 rounded-full blur-3xl"></div>

              <div className="text-center mb-16 relative">
                <div className="inline-block mb-4">
                  <div className="px-4 py-1 bg-[#7CC635]/10 rounded-full text-[#7CC635] text-sm font-medium uppercase tracking-wider">
                    Powerful JSON Tools
                  </div>
                </div>

                <h1 className="text-6xl md:text-8xl font-extrabold mb-6 relative">
                  <span className="text-[#7CC635] drop-shadow-sm">JSON</span>
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#7CC635] to-[#5A9E1C] ml-4">
                    Visualizer
                  </span>
                  <div className="absolute -right-8 top-0 w-16 h-16 bg-yellow-400/20 rounded-full blur-xl"></div>
                </h1>

                <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-10 leading-relaxed">
                  Unlock powerful insights from your JSON data with dynamic,
                  interactive visualizations. Discover new perspectives with
                  every click.
                </p>

                <div className="relative inline-block group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-[#7CC635] to-purple-600 rounded-full blur group-hover:blur-md transition-all duration-300"></div>
                  <Link href="/visualizer" className="relative block">
                    <Button
                      size="lg"
                      data-tip="Start your journey" // <-- added tooltip
                      className="bg-gradient-to-r from-[#7CC635] to-purple-600 hover:from-[#7CC635]/90 hover:to-purple-600/90 text-white rounded-full px-10 py-7 text-lg font-medium flex items-center gap-3 shadow-lg border border-white/10"
                    >
                      Get Started <ArrowRight className="h-5 w-5" />
                    </Button>
                    <ReactToolTip place="top" type="dark" />{' '}
                    {/* <-- global tooltip */}
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Decorative circles */}
          <div className="absolute top-1/4 right-[5%] w-4 h-4 rounded-full bg-pink-400"></div>
          <div className="absolute top-1/3 left-[10%] w-6 h-6 rounded-full bg-blue-400"></div>
          <div className="absolute bottom-1/4 right-[15%] w-8 h-8 rounded-full bg-[#7CC635]"></div>
        </section>

        {/* Features Section */}
        <section className="relative py-20">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
              <FeatureCard
                icon={<FileJson className="h-12 w-12 text-white" />}
                title="Raw JSON View"
                description="View your JSON data with beautiful syntax highlighting. Copy with a single click."
                color="from-pink-500 to-purple-600"
                accentColor="bg-pink-300"
              />

              <FeatureCard
                icon={<FileText className="h-12 w-12 text-white" />}
                title="Parsed JSON View"
                description="See your JSON data in a structured, human-readable format with color-coded values."
                color="from-blue-500 to-cyan-600"
                accentColor="bg-blue-300"
              />

              <FeatureCard
                icon={<GitBranchPlus className="h-12 w-12 text-white" />}
                title="Graphical View"
                description="Explore your JSON structure visually with an interactive, expandable tree view."
                color="from-[#7CC635] to-teal-600"
                accentColor="bg-green-300"
              />
            </div>
          </div>

          {/* Background element */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent -z-10"></div>
        </section>

        {/* Benefits Section */}
        <section className="relative py-20">
          <div className="container mx-auto px-4">
            <div className="relative mb-16 text-center">
              <h2 className="inline-block text-4xl md:text-5xl font-bold relative">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#7CC635] to-purple-600">
                  Why Use JSON Visualizer?
                </span>
                <div className="absolute -bottom-4 left-0 right-0 h-1 bg-gradient-to-r from-[#7CC635] to-purple-600 rounded-full"></div>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              <BenefitCard
                icon={<Eye className="h-6 w-6" />}
                title="Improved Readability"
                description="Transform complex JSON structures into easy-to-read formats with color-coded syntax and structured layouts."
                color="from-pink-500 to-purple-600"
              />

              <BenefitCard
                icon={<Zap className="h-6 w-6" />}
                title="Faster Analysis"
                description="Quickly understand and navigate through your data with intuitive visualization tools and expandable tree views."
                color="from-blue-500 to-cyan-600"
              />

              <BenefitCard
                icon={<Code className="h-6 w-6" />}
                title="Developer Friendly"
                description="Perfect for debugging, testing, and documentation with copy functionality and multiple viewing options."
                color="from-[#7CC635] to-teal-600"
              />
            </div>
          </div>

          {/* Decorative elements */}
          <div className="absolute top-1/4 left-10 w-20 h-20 border-2 border-[#7CC635]/20 rounded-lg rotate-12"></div>
          <div className="absolute bottom-1/4 right-10 w-16 h-16 border-2 border-purple-500/20 rounded-lg -rotate-12"></div>
        </section>

        {/* CTA Section */}
        <section className="relative py-20">
          <div className="container mx-auto px-4">
            <div className="relative max-w-4xl mx-auto">
              <div className="absolute inset-0 bg-gradient-to-r from-[#7CC635]/10 to-purple-600/10 rounded-3xl blur-xl"></div>
              <div className="relative bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-12 rounded-3xl shadow-2xl border border-white/20 dark:border-gray-700/20 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#7CC635] to-purple-600"></div>
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#7CC635]/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-600/10 rounded-full blur-3xl"></div>

                <div className="relative z-10 text-center">
                  <h2 className="text-3xl md:text-4xl font-bold mb-6">
                    Ready to visualize your JSON data?
                  </h2>
                  <p className="text-xl text-gray-600 dark:text-gray-300 mb-10 max-w-2xl mx-auto">
                    Start exploring your JSON files with our beautiful
                    visualization tools. No sign-up required.
                  </p>
                  <div className="inline-block relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-[#7CC635] to-purple-600 rounded-full blur group-hover:blur-md transition-all duration-300"></div>
                    <Link href="/visualizer" className="relative block">
                      <Button
                        size="lg"
                        className="bg-gradient-to-r from-[#7CC635] to-purple-600 hover:from-[#7CC635]/90 hover:to-purple-600/90 text-white rounded-full px-10 py-6 text-lg font-medium"
                      >
                        Try It Now
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-10 border-t border-gray-200 dark:border-gray-800">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="mb-4 md:mb-0">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#7CC635] to-teal-500 flex items-center justify-center mr-2">
                    <FileJson className="h-4 w-4 text-white" />
                  </div>
                  <span className="font-bold text-lg">JSON Visualizer</span>
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                © {new Date().getFullYear()} JSON Visualizer. All rights
                reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  accentColor: string;
}

function FeatureCard({
  icon,
  title,
  description,
  color,
  accentColor,
}: FeatureCardProps) {
  return (
    <div className="relative group">
      <div className="absolute -inset-1 bg-gradient-to-r from-white/50 to-white/20 dark:from-gray-800/50 dark:to-gray-800/20 rounded-2xl blur-sm"></div>
      <div className="relative bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/50 dark:border-gray-700/50 h-full overflow-hidden">
        {/* Accent corner */}
        <div
          className="absolute -top-10 -right-10 w-20 h-20 rounded-full blur-xl opacity-50 group-hover:opacity-70 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle, ${accentColor}, transparent 70%)`,
          }}
        ></div>

        <div
          className={`bg-gradient-to-r ${color} w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-lg transform -rotate-3`}
        >
          {icon}
        </div>

        <h3 className="text-2xl font-bold mb-4">{title}</h3>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          {description}
        </p>

        {/* Bottom accent */}
        <div
          className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            backgroundImage: `linear-gradient(to right, ${accentColor}, transparent)`,
          }}
        ></div>
      </div>
    </div>
  );
}

interface BenefitCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

function BenefitCard({ icon, title, description, color }: BenefitCardProps) {
  return (
    <div className="relative group">
      <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-white/30 dark:border-gray-700/30 h-full overflow-hidden">
        <div
          className="absolute -top-10 -left-10 w-20 h-20 bg-gradient-to-r opacity-10 group-hover:opacity-20 transition-opacity duration-300 rounded-full blur-xl"
          style={{ backgroundImage: `linear-gradient(to right, ${color})` }}
        ></div>

        <div className="flex items-start">
          <div
            className={`bg-gradient-to-r ${color} p-4 rounded-xl mr-5 text-white shadow-md`}
          >
            {icon}
          </div>
          <div>
            <h3 className="text-xl font-bold mb-2">{title}</h3>
            <p className="text-gray-600 dark:text-gray-400">{description}</p>
          </div>
        </div>

        <div
          className="absolute bottom-0 right-0 w-full h-1 bg-gradient-to-l opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            backgroundImage: `linear-gradient(to left, ${color}, transparent)`,
          }}
        ></div>
      </div>
    </div>
  );
}
