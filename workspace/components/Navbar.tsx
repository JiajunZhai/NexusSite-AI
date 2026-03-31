'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';

const navLinks = [
  { href: '/', label: '首页' },
  { href: '/features', label: '功能' },
  { href: '/pricing', label: '定价' },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <Zap className="h-6 w-6 text-indigo-500" />
          <span>NexusSite-AI</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-indigo-400 ${
                pathname === link.href ? 'text-indigo-400' : 'text-slate-400'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <Link href="/pricing" className="hidden md:block">
            <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
              登录
            </Button>
          </Link>
          <Link href="/pricing">
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white">
              开始使用
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
