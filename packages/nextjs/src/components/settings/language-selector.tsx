"use client"

import { Globe } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

interface Language {
  id: string
  label: string
}

const languages: Language[] = [
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
  { id: "fr", label: "Français" },
  { id: "de", label: "Deutsch" },
]

interface LanguageSelectorProps {
  selectedLanguages: string[]
  onLanguageChange: (langId: string) => void
}

export function LanguageSelector({ selectedLanguages, onLanguageChange }: LanguageSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-3 mb-4">
        <Globe className="h-5 w-5 text-teal-600 dark:text-teal-400" />
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Content Languages</h3>
      </div>
      <div className="grid sm:grid-cols-2 gap-4 pl-8">
        {languages.map((lang) => (
          <div key={lang.id} className="flex items-center space-x-2 group">
            <Checkbox
              id={lang.id}
              checked={selectedLanguages.includes(lang.id)}
              onCheckedChange={() => onLanguageChange(lang.id)}
              className="border-gray-300 dark:border-gray-600 data-[state=checked]:bg-teal-500 data-[state=checked]:border-teal-500"
            />
            <Label 
              htmlFor={lang.id} 
              className="text-base font-medium text-gray-700 dark:text-gray-300 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors"
            >
              {lang.label}
            </Label>
          </div>
        ))}
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 pl-8 mt-2">
        Select languages for content display
      </p>
    </div>
  )
}