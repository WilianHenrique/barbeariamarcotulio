import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

interface FilterBarProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  periodFilter: string;
  setPeriodFilter: (value: string) => void;
}

export const FilterBar = ({ searchTerm, setSearchTerm, periodFilter, setPeriodFilter }: FilterBarProps) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome do cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-card/50 border-border/50 focus:border-primary/50"
        />
      </div>
      <Select value={periodFilter} onValueChange={setPeriodFilter}>
        <SelectTrigger className="w-full sm:w-[200px] bg-card/50 border-border/50">
          <SelectValue placeholder="Período" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os períodos</SelectItem>
          <SelectItem value="today">Hoje</SelectItem>
          <SelectItem value="week">Esta semana</SelectItem>
          <SelectItem value="month">Este mês</SelectItem>
          <SelectItem value="year">Este ano</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
