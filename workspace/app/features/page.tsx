import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import AIPlanningSection from '@/components/features/AIPlanningSection';
import SmartDesignSection from '@/components/features/SmartDesignSection';
import AutoCodeSection from '@/components/features/AutoCodeSection';
import QualityAssuranceSection from '@/components/features/QualityAssuranceSection';
import { Sparkles } from 'lucide-react';

export default function FeaturesPage() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-24 space-y-24">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-600 mb-6">
            <Sparkles className="h-4 w-4" />
            核心功能
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 mb-4">
            全流程 AI 驱动开发
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            从需求规划到质量保障，一站式智能化工作流，让创意快速落地为高质量产品。
          </p>
        </div>

        <AIPlanningSection />
        <SmartDesignSection />
        <AutoCodeSection />
        <QualityAssuranceSection />
      </div>
      <Footer />
    </main>
  );
}
