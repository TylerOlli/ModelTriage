"use client";

/**
 * Prompt Composer
 *
 * The main input area for submitting prompts. Contains:
 *   - Textarea with drag-and-drop file attachment
 *   - Action bar (mode toggle, attach, history, char count, submit)
 *   - Model selection chips (compare mode)
 *   - Prompt history popover
 *
 * All business logic (streaming, API calls) stays in the parent.
 * This component only manages its own UI state (drag, history menu).
 */

import { useState, useRef, type RefObject, type FormEvent } from "react";
import { validateFiles, getFileValidationErrorMessage } from "@/lib/file-validation";
import { availableModels, formatFileSize } from "@/lib/models";
import type { ConversationSession } from "@/lib/session-types";
import type { User } from "@supabase/supabase-js";

interface UsageInfo {
  used: number;
  limit: number;
  remaining: number;
  period: "lifetime" | "daily";
  label: string;
}

interface PromptComposerProps {
  prompt: string;
  setPrompt: (value: string) => void;
  isStreaming: boolean;
  hasResults: boolean;
  comparisonMode: boolean;
  onModeSwitch: (compare: boolean) => void;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
  onClear: () => void;
  /** Auth state */
  user: User | null;
  usage: UsageInfo | null;
  /** File attachments */
  attachedFiles: File[];
  onFilesChange: (files: File[]) => void;
  /** Model selection (compare mode) */
  selectedModels: string[];
  onSelectedModelsChange: (models: string[]) => void;
  /** Prompt history */
  promptHistory: string[];
  onClearHistory: () => void;
  /** Draft persistence */
  rememberDrafts: boolean;
  onRememberDraftsChange: (value: boolean) => void;
  /** Session info for conversation indicator */
  session: ConversationSession | null;
  /** Ref to the textarea for external focus */
  promptInputRef: RefObject<HTMLTextAreaElement | null>;
}

export function PromptComposer({
  prompt,
  setPrompt,
  isStreaming,
  hasResults,
  comparisonMode,
  onModeSwitch,
  onSubmit,
  onCancel,
  onClear,
  user,
  usage,
  attachedFiles,
  onFilesChange,
  selectedModels,
  onSelectedModelsChange,
  promptHistory,
  onClearHistory,
  rememberDrafts,
  onRememberDraftsChange,
  session,
  promptInputRef,
}: PromptComposerProps) {
  // ── Local UI state ──────────────────────────────────────────
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showHistoryMenu, setShowHistoryMenu] = useState(false);

  const characterCount = prompt.length;
  const isOverLimit = characterCount > 4000;

  // ── File handlers ───────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (attachedFiles.length + files.length > 3) {
      alert("Maximum 3 files allowed");
      return;
    }
    const { validFiles, invalidFiles } = validateFiles(files);
    if (invalidFiles.length > 0) alert(getFileValidationErrorMessage(invalidFiles));
    if (validFiles.length > 0) onFilesChange([...attachedFiles, ...validFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveFile = (index: number) => {
    onFilesChange(attachedFiles.filter((_, i) => i !== index));
  };

  // ── Drag-and-drop ──────────────────────────────────────────
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isStreaming || attachedFiles.length >= 3) return;
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setIsDraggingOver(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    dragCounterRef.current = 0;
    if (isStreaming) return;
    const droppedFiles = Array.from(e.dataTransfer.files);
    const { validFiles, invalidFiles } = validateFiles(droppedFiles);
    if (invalidFiles.length > 0) alert(getFileValidationErrorMessage(invalidFiles));
    if (attachedFiles.length + validFiles.length > 3) {
      alert(`Maximum 3 files allowed. You have ${attachedFiles.length} file(s) attached and tried to add ${validFiles.length} more.`);
      return;
    }
    if (validFiles.length > 0) onFilesChange([...attachedFiles, ...validFiles]);
  };

  return (
    <>
      <form onSubmit={onSubmit} className="mb-10">
        <div
          className={`relative bg-white rounded-2xl border transition-all duration-200 ${
            isDraggingOver
              ? "border-blue-400 ring-4 ring-blue-500/10"
              : isOverLimit
                ? "border-red-300 shadow-sm"
                : "border-neutral-200/80 shadow-[0_0_0_1px_rgba(0,0,0,0.02),0_1px_6px_rgba(0,0,0,0.04)] focus-within:border-neutral-300 focus-within:shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_2px_12px_rgba(0,0,0,0.06)]"
          }`}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Drag-and-drop overlay */}
          {isDraggingOver && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-blue-50/80 rounded-2xl border-2 border-blue-400 border-dashed pointer-events-none">
              <div className="text-center">
                <svg className="w-8 h-8 text-blue-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                <div className="text-sm font-medium text-blue-700">Drop files to attach</div>
                {attachedFiles.length > 0 && (
                  <div className="text-sm text-blue-500 mt-1">{3 - attachedFiles.length} more allowed</div>
                )}
              </div>
            </div>
          )}

          {/* Conversation active indicator */}
          {session && session.turns.length > 0 && (
            <div className="px-5 pt-3 pb-0">
              <span className="inline-flex items-center gap-1.5 text-sm text-blue-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Conversation active &middot; {session.turns.length} turn{session.turns.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={promptInputRef}
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What do you want to ask?"
            className="w-full px-5 pt-4 pb-2 border-0 outline-none resize-none bg-transparent text-[15px] leading-relaxed text-neutral-900 placeholder:text-neutral-400 disabled:text-neutral-400"
            rows={4}
            disabled={isStreaming}
            aria-describedby="character-count"
          />

          {/* File Attachments */}
          {attachedFiles.length > 0 && (
            <div className="px-5 pb-2">
              <div className="flex flex-wrap gap-2">
                {attachedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-2 px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm"
                  >
                    <span className="text-neutral-500">
                      {file.type.startsWith("image/") ? (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      )}
                    </span>
                    <span className="text-neutral-700 font-medium truncate max-w-[200px]">{file.name}</span>
                    <span className="text-neutral-400 text-sm">{formatFileSize(file.size)}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(index)}
                      disabled={isStreaming}
                      className="ml-0.5 text-neutral-400 hover:text-neutral-600 disabled:opacity-50 transition-colors"
                      aria-label={`Remove ${file.name}`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-sm text-amber-600 mt-2">
                Attachments are sent to the model. Avoid sensitive data.
              </p>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-neutral-100">
            {/* Left: Mode toggle + utilities */}
            <div className="flex items-center gap-3">
              {/* Pill toggle */}
              <div className="inline-flex rounded-lg bg-neutral-100 p-0.5">
                <button
                  type="button"
                  onClick={() => onModeSwitch(false)}
                  disabled={isStreaming}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150 ${
                    !comparisonMode
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-700"
                  } ${isStreaming ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  Auto-select
                </button>
                <button
                  type="button"
                  onClick={() => onModeSwitch(true)}
                  disabled={isStreaming}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150 ${
                    comparisonMode
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-700"
                  } ${isStreaming ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  Compare
                </button>
              </div>

              {/* Divider */}
              <div className="w-px h-5 bg-neutral-200" />

              {/* Attach */}
              <input ref={fileInputRef} type="file" onChange={handleFileSelect} multiple className="hidden" disabled={isStreaming} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isStreaming || attachedFiles.length >= 3}
                className="text-sm text-neutral-400 hover:text-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                <span className="hidden sm:inline">Attach</span>
              </button>

              {/* History */}
              {!user ? (
                <div className="relative group/history">
                  <button
                    type="button"
                    disabled
                    className="text-sm text-neutral-300 cursor-not-allowed flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span className="hidden sm:inline">History</span>
                  </button>
                  <div className="absolute bottom-full left-0 mb-2 px-3 py-1.5 bg-neutral-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover/history:opacity-100 transition-opacity pointer-events-none">
                    Sign in to save prompt history
                  </div>
                </div>
              ) : promptHistory.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-sm text-neutral-400 hover:text-neutral-600 transition-colors duration-150 flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="hidden sm:inline">History</span>
                </button>
              ) : null}
            </div>

            {/* Right: char count + submit */}
            <div className="flex items-center gap-3">
              {/* Anonymous usage indicator */}
              {!user && usage && usage.limit > 0 && (
                <span className={`text-xs tabular-nums ${usage.remaining <= 1 ? "text-amber-500 font-medium" : "text-neutral-400"}`}>
                  {usage.remaining}/{usage.limit} free
                </span>
              )}

              <span
                id="character-count"
                className={`text-sm tabular-nums ${isOverLimit ? "text-red-500 font-medium" : "text-neutral-400"}`}
              >
                {characterCount > 0 ? `${characterCount} / 4,000` : ""}
              </span>

              {isStreaming ? (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-1.5 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors duration-150"
                >
                  Cancel
                </button>
              ) : hasResults ? (
                <button
                  type="button"
                  onClick={onClear}
                  className="px-4 py-1.5 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors duration-150"
                >
                  Clear
                </button>
              ) : null}

              <div className="relative group/submit">
                <button
                  type="submit"
                  disabled={isStreaming || !prompt.trim() || isOverLimit || (usage !== null && usage.remaining <= 0)}
                  className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 active:scale-95 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed transition-all duration-150"
                  aria-label="Submit prompt"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
                {usage !== null && usage.remaining <= 0 && (
                  <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-neutral-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover/submit:opacity-100 transition-opacity pointer-events-none">
                    {user ? "Daily limit reached" : "Free requests used — sign up to continue"}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Model Selection Chips (Compare mode) */}
          <div className={`transition-all duration-200 ease-out ${
            comparisonMode ? "opacity-100" : "max-h-0 opacity-0 overflow-hidden"
          }`}>
            {comparisonMode && (
              <div className="px-5 pb-4 pt-2 border-t border-neutral-100 overflow-visible">
                <div className="flex flex-wrap gap-2">
                  {availableModels.map((model) => {
                    const isSelected = selectedModels.includes(model.id);
                    return (
                      <div key={model.id} className="relative group/chip">
                        <button
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              if (selectedModels.length > 1) {
                                onSelectedModelsChange(selectedModels.filter((id) => id !== model.id));
                              }
                            } else {
                              onSelectedModelsChange([...selectedModels, model.id]);
                            }
                          }}
                          disabled={isStreaming}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 ${
                            isSelected
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-white text-neutral-500 border border-neutral-200 hover:border-neutral-300 hover:text-neutral-700"
                          } ${isStreaming ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          {isSelected && (
                            <svg className="w-3 h-3 inline mr-1 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          )}
                          {model.label}
                        </button>
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2.5 py-1 bg-neutral-700 text-white text-xs rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover/chip:opacity-90 transition-opacity duration-300 delay-300 z-10">
                          {model.description}
                          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-neutral-700" />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-sm text-neutral-400 mt-2">
                  {selectedModels.length} model{selectedModels.length !== 1 ? "s" : ""} selected
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Prompt History Popover */}
        {showHistory && promptHistory.length > 0 && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowHistory(false)} />
            <div className="relative z-20 mt-2 animate-enter">
              <div className="bg-white rounded-xl border border-neutral-200 shadow-lg overflow-visible">
                <div className="px-4 py-3 border-b border-neutral-100">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-neutral-900">Recent prompts</h4>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setShowHistoryMenu(!showHistoryMenu); }}
                        className="p-1 text-neutral-400 hover:text-neutral-600 rounded-md transition-colors duration-150"
                        aria-label="History options"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </button>
                      {showHistoryMenu && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setShowHistoryMenu(false)} />
                          <div className="absolute right-0 top-full mt-1 z-40 bg-white rounded-lg border border-neutral-200 shadow-lg py-1 min-w-[180px] animate-enter">
                            <button type="button" onClick={() => { onClearHistory(); setShowHistoryMenu(false); setShowHistory(false); }} className="w-full text-left px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors">Clear history</button>
                            <div className="h-px bg-neutral-100 my-1" />
                            <button type="button" onClick={() => { onRememberDraftsChange(!rememberDrafts); setShowHistoryMenu(false); }} className="w-full text-left px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors flex items-center justify-between gap-2">
                              <span>Remember drafts</span>
                              <div className={`w-8 h-4 rounded-full transition-colors duration-200 ${rememberDrafts ? 'bg-blue-600' : 'bg-neutral-300'}`}>
                                <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-200 mt-0.5 ${rememberDrafts ? 'ml-4' : 'ml-0.5'}`} />
                              </div>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  {rememberDrafts && <p className="text-sm text-blue-600 mt-1">Draft auto-saved on this device</p>}
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {promptHistory.map((historyItem, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => { setPrompt(historyItem); setShowHistory(false); }}
                      className="w-full text-left px-4 py-3 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors duration-150 border-b border-neutral-50 last:border-b-0 group"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex-1 truncate">{historyItem}</span>
                        <span className="text-sm text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">Reuse</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </form>
    </>
  );
}
