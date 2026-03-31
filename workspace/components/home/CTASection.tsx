import { ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function CTASection() {
  return (
    <section className="relative overflow-hidden bg-slate-50 py-24 sm:py-32">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-indigo-50 via-white to-purple-50" />
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-medium text-indigo-700">
            <Sparkles className="h-4 w-4" />
            <span>Ready to transform your workflow?</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Start building with NexusSite-AI today
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Join thousands of developers and designers who are shipping faster with AI-powered tools. No credit card required.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              href="/signup"
              className="rounded-md bg-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 transition-colors"
            >
              Get Started Free
            </Link>
            <Link
              href="/demo"
              className="text-sm font-semibold leading-6 text-slate-900 hover:text-indigo-600 transition-colors flex items-center gap-1"
            >
              View Live Demo <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
