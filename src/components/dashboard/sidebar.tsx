'use client';

import { useState } from 'react';
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
  Users,
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

// Content badges (live counts) keyed by nav item name. Identity shows who's signed
// in, with which role, in which organization — so every role knows what it can do.
export interface SidebarBadges {
  Licitații?: number;
  'Analiză AI'?: number;
  Watchdog?: number;
}

export interface SidebarIdentity {
  name: string;
  roleLabel: string;
  orgName?: string | null;
}

interface SidebarNavProps {
  onNavigate?: () => void;
  badges?: SidebarBadges;
  identity?: SidebarIdentity;
  showTeam?: boolean;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Licitații', href: '/tenders', icon: Search },
  { name: 'Analiză AI', href: '/analysis', icon: BarChart3 },
  { name: 'Documente', href: '/documents', icon: FileText },
  { name: 'Watchdog', href: '/watchdog', icon: Bell },
  { name: 'Setări', href: '/settings', icon: Settings },
];

// Team page is OWNER/ADMIN-only at the API layer — showing it to MEMBER would
// dead-end in a 403, so the menu mirrors the permission instead.
const teamItem = { name: 'Echipă', href: '/invitations', icon: Users };

function SidebarNav({ onNavigate, badges, identity, showTeam }: SidebarNavProps) {
  const pathname = usePathname();

  const items = showTeam
    ? [...navigation.slice(0, 5), teamItem, ...navigation.slice(5)]
    : navigation;

  return (
    <>
      <nav className="flex-1 px-4 py-4 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const badge = badges?.[item.name as keyof SidebarBadges];
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors min-h-[44px] min-w-[44px]',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="mr-3 h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="flex-1">{item.name}</span>
              {badge !== undefined && badge > 0 && (
                <span
                  className={cn(
                    'ml-2 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                    isActive
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-primary/10 text-primary'
                  )}
                >
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-4 border-t space-y-3">
        {identity && (
          <div className="text-xs">
            <p className="font-medium truncate">{identity.name}</p>
            <p className="text-muted-foreground truncate">
              {identity.roleLabel}
              {identity.orgName ? ` · ${identity.orgName}` : ''}
            </p>
          </div>
        )}
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
export function Sidebar({
  badges,
  identity,
  showTeam,
}: {
  badges?: SidebarBadges;
  identity?: SidebarIdentity;
  showTeam?: boolean;
}) {
  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 z-30">
      <div className="flex flex-col flex-grow bg-card border-r">
        <div className="flex items-center h-16 px-6 border-b shrink-0">
          <Building2 className="h-8 w-8 text-primary shrink-0" aria-hidden="true" />
          <span className="ml-3 text-xl font-bold truncate">SEAP Assistant</span>
        </div>
        <SidebarNav badges={badges} identity={identity} showTeam={showTeam} />
      </div>
    </aside>
  );
}

// Mobile sidebar — Sheet with auto-close on navigate and localStorage persistence
export function MobileSidebar({ showTeam }: { showTeam?: boolean }) {
  const [open, setOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedState = localStorage.getItem('mobile-sidebar-open');
      return savedState === 'true';
    }
    return false;
  });

  // Save sidebar state to localStorage when it changes
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    localStorage.setItem('mobile-sidebar-open', String(newOpen));
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden min-h-[44px] min-w-[44px]" aria-label="Deschide meniu">
          <Menu className="h-6 w-6" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0" showCloseButton={false}>
        <SheetHeader className="h-16 px-6 border-b flex flex-row items-center justify-start gap-3 shrink-0">
          <Building2 className="h-8 w-8 text-primary shrink-0" aria-hidden="true" />
          <SheetTitle className="text-xl font-bold">SEAP</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col flex-1 overflow-y-auto">
          <SidebarNav onNavigate={() => handleOpenChange(false)} showTeam={showTeam} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
