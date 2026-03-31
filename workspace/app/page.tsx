import HeroSection from '@/components/home/HeroSection';
import WorkflowSection from '@/components/home/WorkflowSection';
import CaseStudiesSection from '@/components/home/CaseStudiesSection';
import CTASection from '@/components/home/CTASection';

export default function HomePage() {
  return (
    <main className="flex flex-col min-h-screen bg-white dark:bg-gray-950">
      <HeroSection />
      <WorkflowSection />
      <CaseStudiesSection />
      <CTASection />
    </main>
  );
}
