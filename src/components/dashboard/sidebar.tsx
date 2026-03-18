'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Search,
  FileText,
  BarChart3,
  Bell,
  Settings,
  Building2,
  Menu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Licitații', href: '/tenders', icon: Search },
  { name: 'Analiză AI', href: '/analysis', icon: BarChart3 },
  { name: 'Documente', href: '/documents', icon: FileText },
  { name: 'Watchdog', href: '/watchdog', icon: Bell },
  { name: 'Setări', href: '/settings', icon: Settings },
];

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      <nav className="flex-1 px-4 py-4 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="mr-3 h-5 w-5 shrink-0" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-4 border-t space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Tema:</span>
          <ThemeToggle />
        </div>
        <div className="text-xs text-muted-foreground">
          <p>SEAP Assistant v1.1</p>
        </div>
      </div>
    </>
  );
}

// Desktop sidebar — fixed left
export function Sidebar() {
  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 z-30">
      <div className="flex flex-col flex-grow bg-card border-r">
        <div className="flex items-center h-16 px-6 border-b shrink-0">
          <Building2 className="h-8 w-8 text-primary shrink-0" />
          <span className="ml-3 text-xl font-bold truncate">SEAP Assistant</span>
        </div>
        <SidebarNav />
      </div>
    </aside>
  );
}

// Mobile sidebar — Sheet with auto-close on navigate and localStorage persistence
export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  // Load sidebar state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('mobile-sidebar-open');
    if (savedState) {
      setOpen(savedState === 'true');
    }
  }, []);

  // Save sidebar state to localStorage when it changes
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    localStorage.setItem('mobile-sidebar-open', String(newOpen));
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-6 w-6" />
          <span className="sr-only">Deschide meniu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0" showCloseButton={false}>
        <SheetHeader className="h-16 px-6 border-b flex flex-row items-center justify-start gap-3 shrink-0">
          <Building2 className="h-8 w-8 text-primary shrink-0" />
          <SheetTitle className="text-xl font-bold">SEAP</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col flex-1 overflow-y-auto">
          <SidebarNav onNavigate={() => handleOpenChange(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
