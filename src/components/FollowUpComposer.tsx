"use client";

import React from "react";

interface FollowUpComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  placeholder?: string;
  disabled?: boolean;
  helperText?: string;
}

export function FollowUpComposer({
  value,
  onChange,
  onSubmit,
  isLoading = false,
  placeholder = "Ask a follow-up question…",
  disabled = false,
  helperText = "Press Enter to submit • Shift+Enter for new line",
}: FollowUpComposerProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter, allow Shift+Enter for newline
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      
      const trimmedValue = value.trim();
      if (!trimmedValue || isLoading || disabled) return;
      
      onSubmit();
    }
  };

  const handleClick = () => {
    const trimmedValue = value.trim();
    if (!trimmedValue || isLoading || disabled) return;
    
    onSubmit();
  };

  return (
    <div className="px-6 pb-5 pt-3 border-t border-gray-200/60">
      <div className="relative flex items-center gap-2">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled || isLoading}
          className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-lg outline-none resize-none bg-white text-gray-900 placeholder:text-gray-400 transition-all duration-200 ease-out focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed peer"
          style={{ minHeight: '44px', maxHeight: '120px' }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = Math.min(target.scrollHeight, 120) + 'px';
          }}
        />
        
        {/* Send button - matches primary CTA styling */}
        <button
          type="button"
          onClick={handleClick}
          disabled={!value.trim() || isLoading || disabled}
          className="flex-shrink-0 w-11 h-11 flex items-center justify-center bg-blue-600 text-white rounded-lg hover:bg-gradient-to-br hover:from-blue-600 hover:to-blue-700 active:translate-y-[1px] disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 shadow-sm group"
          aria-label="Send follow-up"
        >
          <svg 
            className="w-5 h-5 transition-transform duration-150 group-hover:translate-x-0.5" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
      
      {helperText && (
        <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed opacity-60 peer-focus:opacity-100 transition-opacity duration-200">
          {helperText}
        </p>
      )}
    </div>
  );
}
