"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { LoaderCircle, MapPin, Search } from "lucide-react";
import { mapConfig } from "@/constants/map";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { fetchGeoapifyAutocompleteSuggestions } from "@/lib/geoapify";
import { cn } from "@/lib/utils";
import type { GeoapifyAddressSuggestion } from "@/types/geoapify";

type AddressAutocompleteInputProps = {
  label: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  ariaInvalid?: boolean;
  hasResolvedSelection?: boolean;
  onChange: (value: string) => void;
  onSelect: (suggestion: GeoapifyAddressSuggestion) => void;
};

export function AddressAutocompleteInput({
  label,
  value,
  placeholder,
  disabled,
  ariaInvalid,
  hasResolvedSelection = false,
  onChange,
  onSelect,
}: AddressAutocompleteInputProps) {
  const listId = useId();
  const debouncedValue = useDebouncedValue(value, 260);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [suggestions, setSuggestions] = useState<GeoapifyAddressSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const shouldSearch = debouncedValue.trim().length >= 3;
  const hasSuggestions = suggestions.length > 0;
  const showDropdown = isOpen && (hasSuggestions || isLoading || Boolean(errorMessage));

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!mapConfig.supportsAutocomplete || !shouldSearch || hasResolvedSelection) {
      return;
    }

    const abortController = new AbortController();

    async function runAutocomplete() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextSuggestions = await fetchGeoapifyAutocompleteSuggestions(
          debouncedValue,
          {
            signal: abortController.signal,
            limit: 6,
            lang: "ro",
            filter: "countrycode:ro",
            bias: "proximity:24.8692,44.8565",
          },
        );

        setSuggestions(nextSuggestions);
        setIsOpen(true);
        setHighlightedIndex(nextSuggestions.length > 0 ? 0 : -1);
      } catch {
        if (abortController.signal.aborted) {
          return;
        }

        setSuggestions([]);
        setHighlightedIndex(-1);
        setErrorMessage("Sugestiile de adresă sunt temporar indisponibile.");
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void runAutocomplete();

    return () => abortController.abort();
  }, [debouncedValue, hasResolvedSelection, shouldSearch]);

  const activeSuggestion = useMemo(() => {
    if (highlightedIndex < 0) {
      return null;
    }

    return suggestions[highlightedIndex] ?? null;
  }, [highlightedIndex, suggestions]);

  function applySuggestion(suggestion: GeoapifyAddressSuggestion) {
    onSelect(suggestion);
    setSuggestions([]);
    setIsOpen(false);
    setHighlightedIndex(-1);
  }

  return (
    <div ref={containerRef} className="grid min-w-0 gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          role="combobox"
          value={value}
          disabled={disabled}
          aria-invalid={ariaInvalid}
          aria-expanded={showDropdown}
          aria-controls={showDropdown ? listId : undefined}
          aria-activedescendant={activeSuggestion ? `${listId}-${activeSuggestion.id}` : undefined}
          aria-autocomplete="list"
          className={cn(
            "h-12 w-full rounded-2xl border border-input bg-card pl-11 pr-11 text-sm text-foreground shadow-none outline-none transition-[border-color,box-shadow,background-color] placeholder:text-muted-foreground/90 focus-visible:border-primary/15 focus-visible:ring-4 focus-visible:ring-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted/70 disabled:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-destructive/10",
          )}
          placeholder={placeholder}
          onFocus={() => {
            if (hasSuggestions || isLoading || errorMessage) {
              setIsOpen(true);
            }
          }}
          onChange={(event) => {
            const nextValue = event.target.value;

            onChange(nextValue);

            if (nextValue.trim().length < 3) {
              setSuggestions([]);
              setIsLoading(false);
              setErrorMessage(null);
              setHighlightedIndex(-1);
              setIsOpen(false);
              return;
            }

            setIsOpen(true);
          }}
          onKeyDown={(event) => {
            if (!showDropdown || suggestions.length === 0) {
              return;
            }

            if (event.key === "ArrowDown") {
              event.preventDefault();
              setHighlightedIndex((currentValue) =>
                currentValue >= suggestions.length - 1 ? 0 : currentValue + 1,
              );
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlightedIndex((currentValue) =>
                currentValue <= 0 ? suggestions.length - 1 : currentValue - 1,
              );
            }

            if (event.key === "Enter" && activeSuggestion) {
              event.preventDefault();
              applySuggestion(activeSuggestion);
            }

            if (event.key === "Escape") {
              setIsOpen(false);
            }
          }}
        />

        {isLoading ? (
          <LoaderCircle className="absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}

        {showDropdown ? (
          <div
            id={listId}
            role="listbox"
            className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 max-h-[min(18rem,46svh)] overflow-y-auto overscroll-contain rounded-[1.35rem] border border-border/80 bg-card shadow-[var(--elevation-panel)]"
          >
            {errorMessage ? (
              <div className="px-4 py-4 text-sm leading-6 text-muted-foreground">
                {errorMessage}
              </div>
            ) : hasSuggestions ? (
              <div className="grid gap-1 p-2">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={suggestion.id}
                    id={`${listId}-${suggestion.id}`}
                    type="button"
                    role="option"
                    aria-selected={highlightedIndex === index}
                    className={cn(
                      "grid gap-1 rounded-[1rem] px-4 py-3 text-left transition-colors",
                      highlightedIndex === index
                        ? "bg-secondary text-foreground"
                        : "hover:bg-secondary/70",
                    )}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      applySuggestion(suggestion);
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 size-4 text-foreground" />
                      <div className="grid gap-1">
                        <span className="text-sm font-medium text-foreground">
                          {suggestion.label}
                        </span>
                        {suggestion.secondaryLabel ? (
                          <span className="text-sm leading-6 text-muted-foreground">
                            {suggestion.secondaryLabel}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-4 py-4 text-sm leading-6 text-muted-foreground">
                {shouldSearch
                  ? "Nu am găsit încă sugestii de adresă."
                  : "Începe să scrii ca să vezi sugestii de adresă."}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
