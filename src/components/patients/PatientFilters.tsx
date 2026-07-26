import { Input, Select } from "@/components/ui";
import { LIFECYCLE_STATES, LIFECYCLE_LABELS, PACKAGE_TYPES } from "@/types/database";
import type { LifecycleState, PackageType } from "@/types/database";
import { Search } from "lucide-react";

interface PatientFiltersProps {
  search: string;
  status: LifecycleState | "";
  packageType: PackageType | "";
  onSearchChange: (value: string) => void;
  onStatusChange: (value: LifecycleState | "") => void;
  onPackageTypeChange: (value: PackageType | "") => void;
}

const packageLabels: Record<PackageType, string> = {
  standard: "Standard",
  premium: "Premium",
  vip: "VIP",
};

export function PatientFilters({
  search,
  status,
  packageType,
  onSearchChange,
  onStatusChange,
  onPackageTypeChange,
}: PatientFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Status filter */}
      <div className="w-full sm:w-48">
        <Select
          value={status}
          onChange={(e) => onStatusChange(e.target.value as LifecycleState | "")}
        >
          <option value="">All Statuses</option>
          {LIFECYCLE_STATES.map((s) => (
            <option key={s} value={s}>
              {LIFECYCLE_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      {/* Package filter */}
      <div className="w-full sm:w-40">
        <Select
          value={packageType}
          onChange={(e) => onPackageTypeChange(e.target.value as PackageType | "")}
        >
          <option value="">All Packages</option>
          {PACKAGE_TYPES.map((p) => (
            <option key={p} value={p}>
              {packageLabels[p]}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
