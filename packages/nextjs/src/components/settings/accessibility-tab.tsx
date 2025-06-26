'use client';

import React, { useState } from 'react';
import { Switch } from '@/components/ui/switch';

const AccessibilityTab = () => {
  // Estado para el tamaño de fuente
  const [fontSize, setFontSize] = useState(16);
  const minFontSize = 12;
  const maxFontSize = 24;

  // Estado para los switches
  const [highContrast, setHighContrast] = useState(false);
  const [dyslexiaFont, setDyslexiaFont] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [increaseCursor, setIncreaseCursor] = useState(false);
  const [enhancedFocus, setEnhancedFocus] = useState(false);

  const handleFontSizeChange = (value: number) => {
    if (value >= minFontSize && value <= maxFontSize) {
      setFontSize(value);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800/50 rounded-xl p-4 sm:p-6 shadow-sm border">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[#00CED1]">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M1.5 12C3.5 6.5 8 3 12 3C16 3 20.5 6.5 22.5 12C20.5 17.5 16 21 12 21C8 21 3.5 17.5 1.5 12Z"
              stroke="#00CED1"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="3" stroke="#00CED1" strokeWidth="2" />
          </svg>
        </span>
        <h2 className="text-lg font-semibold">Accessibility</h2>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 ml-0 sm:ml-7">
        Customize your experience for better accessibility
      </p>

      {/* Visual Preferences */}
      <div className="ml-0 sm:ml-7 mt-8">
        <h3
          className="font-medium"
          style={{
            fontFamily: 'Inter',
            fontWeight: 500,
            fontSize: '18px',
            lineHeight: '28px',
            letterSpacing: '0%',
          }}
        >
          Visual Preferences
        </h3>
        {/* Font Size */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span
              className="font-semibold"
              style={{
                fontFamily: 'Inter',
                fontWeight: 500,
                fontSize: '14px',
                lineHeight: '20px',
                letterSpacing: '0%',
              }}
            >
              Font Size
            </span>
            <div className="flex items-center gap-2">
              <button
                className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                onClick={() => handleFontSizeChange(fontSize - 1)}
                aria-label="Disminuir tamaño de fuente"
                disabled={fontSize <= minFontSize}
              >
                –
              </button>
              <span
                className="text-sm font-medium w-10 text-center"
                style={{
                  fontFamily: 'Inter',
                  fontWeight: 500,
                  fontSize: '14px',
                  lineHeight: '20px',
                  letterSpacing: '0%',
                }}
              >
                {fontSize}px
              </span>
              <button
                className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                onClick={() => handleFontSizeChange(fontSize + 1)}
                aria-label="Aumentar tamaño de fuente"
                disabled={fontSize >= maxFontSize}
              >
                +
              </button>
            </div>
          </div>
          <input
            type="range"
            min={minFontSize}
            max={maxFontSize}
            value={fontSize}
            onChange={(e) => handleFontSizeChange(Number(e.target.value))}
            className="w-full h-2 rounded-lg mb-3"
            style={{ accentColor: '#00CED1', background: '#374151' }}
            aria-label="Font size slider"
          />
          <div
            className="border rounded px-3 py-2 bg-gray-50 dark:bg-gray-900/30 text-gray-700 dark:text-gray-200"
            style={{
              fontSize: `${fontSize}px`,
              fontFamily: dyslexiaFont ? 'OpenDyslexic, Arial, sans-serif' : 'inherit',
            }}
          >
            This is a preview text that shows how your content will look.
          </div>
        </div>
        {/* High Contrast Mode */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <span
              className="font-medium"
              style={{
                fontFamily: 'Inter',
                fontWeight: 500,
                fontSize: '14px',
                lineHeight: '20px',
                letterSpacing: '0%',
              }}
            >
              High Contrast Mode
            </span>
            <div
              className="text-xs"
              style={{
                fontFamily: 'Inter',
                fontWeight: 400,
                fontSize: '12px',
                lineHeight: '16px',
                letterSpacing: '0%',
                color: '#6B7280',
              }}
            >
              Increase contrast for better visibility
            </div>
          </div>
          <Switch checked={highContrast} onCheckedChange={setHighContrast} />
        </div>
        {/* Dyslexia-Friendly Font */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <span
              className="font-medium"
              style={{
                fontFamily: 'Inter',
                fontWeight: 500,
                fontSize: '14px',
                lineHeight: '20px',
                letterSpacing: '0%',
              }}
            >
              Dyslexia-Friendly Font
            </span>
            <div
              className="text-xs"
              style={{
                fontFamily: 'Inter',
                fontWeight: 400,
                fontSize: '12px',
                lineHeight: '16px',
                letterSpacing: '0%',
                color: '#6B7280',
              }}
            >
              Use a more readable font with increased spacing
            </div>
          </div>
          <Switch checked={dyslexiaFont} onCheckedChange={setDyslexiaFont} />
        </div>
      </div>

      {/* Interaction */}
      <div className="ml-0 sm:ml-7 mt-8">
        <h3
          className="font-medium"
          style={{
            fontFamily: 'Inter',
            fontWeight: 500,
            fontSize: '18px',
            lineHeight: '28px',
            letterSpacing: '0%',
          }}
        >
          Interaction
        </h3>
        {/* Reduce Motion */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <span
              className="font-medium"
              style={{
                fontFamily: 'Inter',
                fontWeight: 500,
                fontSize: '14px',
                lineHeight: '20px',
                letterSpacing: '0%',
              }}
            >
              Reduce Motion
            </span>
            <div
              className="text-xs"
              style={{
                fontFamily: 'Inter',
                fontWeight: 400,
                fontSize: '12px',
                lineHeight: '16px',
                letterSpacing: '0%',
                color: '#6B7280',
              }}
            >
              Minimize animations and transitions
            </div>
          </div>
          <Switch checked={reduceMotion} onCheckedChange={setReduceMotion} />
        </div>
        {/* Increase Cursor Visibility */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <span
              className="font-medium"
              style={{
                fontFamily: 'Inter',
                fontWeight: 500,
                fontSize: '14px',
                lineHeight: '20px',
                letterSpacing: '0%',
              }}
            >
              Increase Cursor Visibility
            </span>
            <div
              className="text-xs"
              style={{
                fontFamily: 'Inter',
                fontWeight: 400,
                fontSize: '12px',
                lineHeight: '16px',
                letterSpacing: '0%',
                color: '#6B7280',
              }}
            >
              Use a larger, more visible cursor
            </div>
          </div>
          <Switch checked={increaseCursor} onCheckedChange={setIncreaseCursor} />
        </div>
      </div>

      {/* Keyboard Navigation */}
      <div className="ml-0 sm:ml-7 mt-8">
        <h3
          className="font-medium"
          style={{
            fontFamily: 'Inter',
            fontWeight: 500,
            fontSize: '18px',
            lineHeight: '28px',
            letterSpacing: '0%',
          }}
        >
          Keyboard Navigation
        </h3>
        {/* Enhanced Focus Indicators */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <span
              className="font-medium"
              style={{
                fontFamily: 'Inter',
                fontWeight: 500,
                fontSize: '14px',
                lineHeight: '20px',
                letterSpacing: '0%',
              }}
            >
              Enhanced Focus Indicators
            </span>
            <div
              className="text-xs"
              style={{
                fontFamily: 'Inter',
                fontWeight: 400,
                fontSize: '12px',
                lineHeight: '16px',
                letterSpacing: '0%',
                color: '#6B7280',
              }}
            >
              Show more visible focus outlines when using keyboard
            </div>
          </div>
          <Switch checked={enhancedFocus} onCheckedChange={setEnhancedFocus} />
        </div>
      </div>

      {/* Aquí irán las siguientes secciones */}
    </div>
  );
};

export default AccessibilityTab;
