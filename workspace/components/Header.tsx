import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <Zap className="h-6 w-6 text-indigo-500" />
          <span>NexusSite-AI</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6">
          <Link href="/" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">首页</Link>
          <Link href="/features" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">功能</Link>
          <Link href="/pricing" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">定价</Link>
        </nav>
        <div className="flex items-center gap-4">
          <Button variant="ghost" className="hidden md:inline-flex">登录</Button>
          <Button>开始使用</Button>
        </div>
      </div>
    </header>
  );
}
