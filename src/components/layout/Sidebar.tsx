import { useNavigate, useLocation } from "react-router-dom";
import { 
  Calendar, 
  Clock, 
  MessageSquare, 
  BarChart3, 
  Settings, 
  LogOut,
  Scissors,
  Menu,
  X,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoBarbearia from "@/assets/logo-barbearia-marco-tulio.jpeg";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navItems = [
  { id: "agenda", label: "Agenda", icon: Calendar },
  { id: "pendentes", label: "Pendentes", icon: Clock },
  { id: "mensagens", label: "Mensagens", icon: MessageSquare },
  { id: "pagamentos", label: "Pagamentos", icon: Calendar },
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "relatorios", label: "Relatórios", icon: BarChart3 },
];

export const Sidebar = ({ activeTab, onTabChange }: SidebarProps) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado com sucesso");
    navigate("/auth");
  };

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="p-5 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-16 h-12 rounded-lg overflow-hidden bg-primary/10 flex items-center justify-center">
            <img
              src={logoBarbearia}
              alt="Logo Barbearia Marco Túlio"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-lg text-primary tracking-wide truncate">
              MARCO TÚLIO
            </h1>
            <p className="text-xs text-muted-foreground">Barbearia Premium</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => {
                onTabChange(item.id);
                setIsOpen(false);
              }}
              className={cn(
                "nav-item w-full",
                isActive && "active"
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer Actions */}
      <div className="p-3 border-t border-border/50 space-y-1">
        <button
          onClick={() => navigate("/settings")}
          className="nav-item w-full"
        >
          <Settings className="w-5 h-5" />
          <span className="font-medium">Configurações</span>
        </button>
        <button
          onClick={handleLogout}
          className="nav-item w-full text-accent hover:text-accent hover:bg-accent/10"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Sair</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>

      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar - Mobile */}
      <aside className={cn(
        "fixed top-0 left-0 h-full w-64 bg-sidebar border-r border-border z-50",
        "flex flex-col transition-transform duration-300 lg:hidden",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <NavContent />
      </aside>

      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-sidebar border-r border-border">
        <NavContent />
      </aside>
    </>
  );
};
