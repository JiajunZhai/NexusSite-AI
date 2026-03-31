import Link from 'next/link';
import { Github, Twitter, Linkedin, Mail, ArrowRight } from 'lucide-react';

const footerLinks = {
  product: [
    { name: '功能介绍', href: '/features' },
    { name: '定价方案', href: '/pricing' },
    { name: '更新日志', href: '#' },
    { name: '路线图', href: '#' },
  ],
  company: [
    { name: '关于我们', href: '#' },
    { name: '博客', href: '#' },
    { name: '加入我们', href: '#' },
    { name: '联系我们', href: '#' },
  ],
  legal: [
    { name: '隐私政策', href: '#' },
    { name: '服务条款', href: '#' },
    { name: 'Cookie 设置', href: '#' },
  ],
};

export default function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400 border-t border-slate-800">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
          <div className="col-span-2 lg:col-span-2">
            <Link href="/" className="text-2xl font-bold text-white tracking-tight">
              NexusSite-AI
            </Link>
            <p className="mt-4 text-sm leading-6 max-w-xs">
              下一代 AI 驱动的网站构建平台。从构思到上线，全程智能化，让创意无限延伸。
            </p>
            <div className="mt-6 flex gap-4">
              <a href="#" className="hover:text-white transition-colors" aria-label="Twitter">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="hover:text-white transition-colors" aria-label="GitHub">
                <Github className="h-5 w-5" />
              </a>
              <a href="#" className="hover:text-white transition-colors" aria-label="LinkedIn">
                <Linkedin className="h-5 w-5" />
              </a>
              <a href="#" className="hover:text-white transition-colors" aria-label="Email">
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">产品</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="text-sm hover:text-white transition-colors">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">公司</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="text-sm hover:text-white transition-colors">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">法律</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="text-sm hover:text-white transition-colors">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs">
            &copy; {new Date().getFullYear()} NexusSite-AI. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-xs">
            <span>订阅我们的更新</span>
            <div className="flex items-center bg-slate-900 rounded-full px-3 py-1.5 border border-slate-700">
              <input
                type="email"
                placeholder="your@email.com"
                className="bg-transparent text-sm text-white placeholder-slate-500 outline-none w-32"
              />
              <button className="ml-2 text-indigo-400 hover:text-indigo-300 transition-colors">
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
