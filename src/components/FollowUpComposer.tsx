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
  placeholder = "Ask a follow-up question\u2026",
  disabled = false,
  helperText = "Press Enter to submit \u00b7 Shift+Enter for new line",
}: FollowUpComposerProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
    <div className="mt-8 pt-6 border-t border-neutral-200/60">
      <div className="relative flex items-end gap-2">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled || isLoading}
          className="flex-1 px-4 py-3 text-[15px] border border-neutral-200 rounded-xl outline-none resize-none bg-white text-neutral-900 placeholder:text-neutral-400 transition-all duration-150 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 disabled:bg-neutral-50 disabled:text-neutral-400 disabled:cursor-not-allowed"
          style={{ minHeight: '48px', maxHeight: '120px' }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = Math.min(target.scrollHeight, 120) + 'px';
          }}
        />
        
        <button
          type="button"
          onClick={handleClick}
          disabled={!value.trim() || isLoading || disabled}
          className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 active:scale-95 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed transition-all duration-150"
          aria-label="Send follow-up"
        >
          <svg 
            className="w-4 h-4" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      
      {helperText && (
        <p className="text-sm text-neutral-400 mt-2 leading-relaxed">
          {helperText}
        </p>
      )}
    </div>
  );
}
