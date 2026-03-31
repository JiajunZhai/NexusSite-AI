'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X, Zap } from 'lucide-react';

const navLinks = [
  { href: '/', label: '首页' },
  { href: '/features', label: '功能介绍' },
  { href: '/pricing', label: '定价方案' },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Zap className="h-6 w-6 text-indigo-600" />
          <span>NexusSite-AI</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-gray-600 transition-colors hover:text-indigo-600"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-4">
          <Link href="/pricing" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700">
            开始使用
          </Link>
        </div>

        <button
          className="md:hidden p-2 text-gray-600 hover:text-gray-900"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {isOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white px-4 py-4">
          <nav className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-base font-medium text-gray-600 hover:text-indigo-600"
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/pricing"
              className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-indigo-700"
              onClick={() => setIsOpen(false)}
            >
              开始使用
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
