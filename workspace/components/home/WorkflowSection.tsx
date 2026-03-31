import { Lightbulb, Palette, Code, CheckCircle } from 'lucide-react';
import SectionWrapper from '@/components/ui/SectionWrapper';

const workflowSteps = [
  {
    icon: Lightbulb,
    title: 'AI 规划',
    description: '输入业务需求，AI 自动生成项目架构、技术选型与功能清单。',
  },
  {
    icon: Palette,
    title: '智能设计',
    description: '基于规划结果，一键生成高保真 UI 原型与交互设计规范。',
  },
  {
    icon: Code,
    title: '自动编码',
    description: '将设计稿精准转换为高质量、可维护的 React/Tailwind 代码。',
  },
  {
    icon: CheckCircle,
    title: '质量保障',
    description: '内置自动化测试、性能优化与无障碍检查，确保生产就绪。',
  },
];

export default function WorkflowSection() {
  return (
    <SectionWrapper id="workflow" className="py-24 bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            从想法到上线，只需四步
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            全流程自动化编排，让开发效率提升 10 倍。
          </p>
        </div>
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {workflowSteps.map((step, index) => (
            <div
              key={step.title}
              className="group relative rounded-2xl border border-gray-200 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
            >
              <div className="absolute -top-4 left-8 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white shadow-sm">
                {index + 1}
              </div>
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-100">
                <step.icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">{step.title}</h3>
              <p className="mt-3 text-base leading-relaxed text-gray-600">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}
