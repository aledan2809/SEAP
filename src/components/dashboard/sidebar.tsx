'use client';

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
} from 'lucide-react';

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Licitații',
    href: '/tenders',
    icon: Search,
  },
  {
    name: 'Analiză AI',
    href: '/analysis',
    icon: BarChart3,
  },
  {
    name: 'Documente',
    href: '/documents',
    icon: FileText,
  },
  {
    name: 'Watchdog',
    href: '/watchdog',
    icon: Bell,
  },
  {
    name: 'Setări',
    href: '/settings',
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
      <div className="flex flex-col flex-grow bg-card border-r">
        {/* Logo */}
        <div className="flex items-center h-16 px-6 border-b">
          <Building2 className="h-8 w-8 text-primary" />
          <span className="ml-3 text-xl font-bold">SEAP Assistant</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t">
          <div className="text-xs text-muted-foreground">
            <p>SEAP Assistant v1.0</p>
            <p className="mt-1">© 2024</p>
          </div>
        </div>
      </div>
    </div>
  );
}
