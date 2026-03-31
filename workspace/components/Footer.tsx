import Link from "next/link";
import { Zap, Github, Twitter, Linkedin } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 py-12">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl">
              <Zap className="h-6 w-6 text-indigo-500" />
              <span>NexusSite-AI</span>
            </Link>
            <p className="text-sm text-slate-400">AI 驱动的网站生成平台，让建站更简单。</p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">产品</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><Link href="/features" className="hover:text-white">功能介绍</Link></li>
              <li><Link href="/pricing" className="hover:text-white">定价方案</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">资源</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><Link href="#" className="hover:text-white">文档</Link></li>
              <li><Link href="#" className="hover:text-white">博客</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">关注我们</h4>
            <div className="flex gap-4">
              <Link href="#" className="text-slate-400 hover:text-white"><Github className="h-5 w-5" /></Link>
              <Link href="#" className="text-slate-400 hover:text-white"><Twitter className="h-5 w-5" /></Link>
              <Link href="#" className="text-slate-400 hover:text-white"><Linkedin className="h-5 w-5" /></Link>
            </div>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-slate-800 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} NexusSite-AI. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
