import { ArrowRight, Sparkles, Zap, Shield } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { GradientText } from '@/components/ui/GradientText';

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white py-24 sm:py-32">
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 flex items-center justify-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-600">
            <Sparkles className="h-4 w-4" />
            <span>AI 驱动的现代网站构建平台</span>
          </div>
          
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            从创意到上线，<br className="hidden sm:block" />
            <GradientText>仅需一次对话</GradientText>
          </h1>
          
          <p className="mt-6 text-lg leading-8 text-gray-600">
            NexusSite-AI 将 AI 规划、智能设计与自动编码无缝融合。告别繁琐的开发流程，
            让专业级网站在几分钟内从概念变为现实。
          </p>
          
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Button variant="primary" size="lg" className="gap-2">
              立即开始 <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="lg">
              查看演示
            </Button>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            { icon: Zap, title: '极速构建', desc: 'AI 自动生成响应式布局与组件' },
            { icon: Sparkles, title: '智能设计', desc: '基于最佳实践的视觉与交互优化' },
            { icon: Shield, title: '企业级质量', desc: '内置无障碍、SEO 与性能保障' },
          ].map((item, i) => (
            <div key={i} className="rounded-2xl border border-gray-100 bg-white/50 p-6 backdrop-blur-sm">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">{item.title}</h3>
              <p className="mt-2 text-sm text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
