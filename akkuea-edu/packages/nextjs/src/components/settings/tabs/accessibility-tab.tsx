'use client';
import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Eye } from 'lucide-react';

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
    <div className="bg-card rounded-xl p-4 sm:p-6 shadow-sm border border-border">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-primary">
          <Eye className="w-5 h-5" />
        </span>
        <h2 className="text-lg font-semibold text-foreground">Accessibility</h2>
      </div>
      <p className="text-sm text-muted mb-4 ml-0 sm:ml-7">
        Customize your experience for better accessibility
      </p>

      {/* Visual Preferences */}
      <div className="ml-0 sm:ml-7 mt-8">
        <h3 className="font-medium text-foreground text-lg">Visual Preferences</h3>

        {/* Font Size */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-foreground text-sm">Font Size</span>
            <div className="flex items-center gap-2">
              <button
                className="w-8 h-8 flex items-center justify-center rounded-full border border-border bg-card shadow-sm text-foreground hover:bg-muted transition-colors"
                onClick={() => handleFontSizeChange(fontSize - 1)}
                aria-label="Disminuir tamaño de fuente"
                disabled={fontSize <= minFontSize}
              >
                –
              </button>
              <span className="text-sm font-medium w-10 text-center text-foreground">
                {fontSize}px
              </span>
              <button
                className="w-8 h-8 flex items-center justify-center rounded-full border border-border bg-card shadow-sm text-foreground hover:bg-muted transition-colors"
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
            className="w-full h-2 rounded-lg mb-3 accent-primary"
            aria-label="Font size slider"
          />
          <div
            className="border border-border rounded px-3 py-2 bg-muted/20 text-foreground"
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
            <span className="font-medium text-foreground text-sm">High Contrast Mode</span>
            <div className="text-xs text-muted">Increase contrast for better visibility</div>
          </div>
          <Switch checked={highContrast} onCheckedChange={setHighContrast} />
        </div>

        {/* Dyslexia-Friendly Font */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="font-medium text-foreground text-sm">Dyslexia-Friendly Font</span>
            <div className="text-xs text-muted">
              Use a more readable font with increased spacing
            </div>
          </div>
          <Switch checked={dyslexiaFont} onCheckedChange={setDyslexiaFont} />
        </div>
      </div>

      {/* Interaction */}
      <div className="ml-0 sm:ml-7 mt-8">
        <h3 className="font-medium text-foreground text-lg">Interaction</h3>

        {/* Reduce Motion */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="font-medium text-foreground text-sm">Reduce Motion</span>
            <div className="text-xs text-muted">Minimize animations and transitions</div>
          </div>
          <Switch checked={reduceMotion} onCheckedChange={setReduceMotion} />
        </div>

        {/* Increase Cursor Visibility */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="font-medium text-foreground text-sm">Increase Cursor Visibility</span>
            <div className="text-xs text-muted">Use a larger, more visible cursor</div>
          </div>
          <Switch checked={increaseCursor} onCheckedChange={setIncreaseCursor} />
        </div>
      </div>

      {/* Keyboard Navigation */}
      <div className="ml-0 sm:ml-7 mt-8">
        <h3 className="font-medium text-foreground text-lg">Keyboard Navigation</h3>

        {/* Enhanced Focus Indicators */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="font-medium text-foreground text-sm">Enhanced Focus Indicators</span>
            <div className="text-xs text-muted">
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
