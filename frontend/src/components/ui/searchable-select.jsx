import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './command';
import { Button } from './button';
import { Check, ChevronsUpDown } from 'lucide-react';

/**
 * SearchableSelect — a type-to-search dropdown for long lists.
 * Drop-in replacement for Shadcn Select where you need search.
 *
 * Props:
 *  - options: [{ value: string, label: string }]
 *  - value: string (selected value)
 *  - onValueChange: (value: string) => void
 *  - placeholder: string
 *  - className: string
 *  - data-testid: string
 */
export function SearchableSelect({ options = [], value, onValueChange, placeholder = "Select...", className = "", ...props }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`justify-between font-normal ${!selected ? 'text-muted-foreground' : ''} ${className}`}
          data-testid={props['data-testid']}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
        <Command>
          <CommandInput placeholder={`Search...`} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map(opt => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => {
                    onValueChange(opt.value === value ? '' : opt.value);
                    setOpen(false);
                  }}
                >
                  <Check className={`mr-2 h-4 w-4 ${value === opt.value ? 'opacity-100' : 'opacity-0'}`} />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
