"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface AddressSuggestion {
  place_id: number;
  display_name: string;
  address: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Start typing an address...",
  className = "",
  disabled = false,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);

    try {
      // Using Nominatim (OpenStreetMap) - free, no API key required
      // Limit to US addresses for better relevance
      const params = new URLSearchParams({
        q: query,
        format: "json",
        addressdetails: "1",
        limit: "5",
        countrycodes: "us", // Limit to US addresses
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        {
          headers: {
            // Required by Nominatim usage policy
            "User-Agent": "TaylorLeonardCRM/1.0",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data);
        setIsOpen(data.length > 0);
        setHighlightedIndex(-1);
      }
    } catch (error) {
      console.error("Failed to fetch address suggestions:", error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    // Debounce API calls - Nominatim requires max 1 request per second
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 500);
  };

  const formatAddress = (suggestion: AddressSuggestion): string => {
    const addr = suggestion.address;
    const parts: string[] = [];

    // Build a clean US-style address
    if (addr.house_number && addr.road) {
      parts.push(`${addr.house_number} ${addr.road}`);
    } else if (addr.road) {
      parts.push(addr.road);
    }

    const city = addr.city || addr.town || addr.village;
    if (city) {
      parts.push(city);
    }

    if (addr.state) {
      if (addr.postcode) {
        parts.push(`${addr.state} ${addr.postcode}`);
      } else {
        parts.push(addr.state);
      }
    }

    return parts.join(", ");
  };

  const handleSelectSuggestion = (suggestion: AddressSuggestion) => {
    const formattedAddress = formatAddress(suggestion);
    onChange(formattedAddress);
    setSuggestions([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[highlightedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={className}
          autoComplete="off"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-(--border) border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-(--border) rounded-xl shadow-lg overflow-hidden"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.place_id}
              type="button"
              onClick={() => handleSelectSuggestion(suggestion)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`w-full px-4 py-3 text-left text-sm transition ${
                index === highlightedIndex
                  ? "bg-(--bg)/10 text-(--text)"
                  : "text-(--text) hover:bg-(--bg)"
              }`}
            >
              <div className="flex items-start gap-2">
                <svg
                  className="w-4 h-4 mt-0.5 text-(--text) shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="line-clamp-2">{formatAddress(suggestion)}</span>
              </div>
            </button>
          ))}
          <div className="px-4 py-2 text-xs text-(--text) bg-(--bg) border-t border-(--border)">
            Powered by OpenStreetMap
          </div>
        </div>
      )}
    </div>
  );
}

