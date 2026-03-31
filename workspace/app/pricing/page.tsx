import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import PricingTiers from '@/components/pricing/PricingTiers';
import FAQSection from '@/components/pricing/FAQSection';

export const metadata: Metadata = {
  title: '定价方案 | NexusSite-AI Demo',
  description: '选择适合您的方案，开启高效建站之旅。',
};

export default function PricingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-950">
      <Navbar />
      <main className="flex-1">
        <section className="py-16 md:py-24 px-4">
          <div className="max-w-7xl mx-auto text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
              透明定价，按需选择
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              无论您是个人开发者还是大型企业，我们都有适合您的方案。随时升级或降级，无隐藏费用。
            </p>
          </div>
          <PricingTiers />
        </section>
        <FAQSection />
      </main>
      <Footer />
    </div>
  );
}
