import { Quote, TrendingUp, Users, Zap } from "lucide-react";

const caseStudies = [
  {
    company: "TechNova Inc.",
    industry: "SaaS Platform",
    quote: "NexusSite-AI reduced our development cycle by 60%. The AI planning and auto-coding features are absolute game-changers for our engineering team.",
    metrics: [
      { label: "Time Saved", value: "60%", icon: TrendingUp },
      { label: "Team Size", value: "12", icon: Users },
    ],
  },
  {
    company: "GreenLeaf Retail",
    industry: "E-commerce",
    quote: "We launched our new storefront in just two weeks. The smart design component perfectly matched our brand guidelines without any manual tweaking.",
    metrics: [
      { label: "Launch Speed", value: "2x", icon: Zap },
      { label: "Conversion", value: "+35%", icon: TrendingUp },
    ],
  },
  {
    company: "FinCore Solutions",
    industry: "FinTech",
    quote: "Security and compliance were our top priorities. The automated quality assurance pipeline gave us complete confidence before every production release.",
    metrics: [
      { label: "Bug Reduction", value: "85%", icon: TrendingUp },
      { label: "Compliance", value: "100%", icon: Users },
    ],
  },
];

export default function CaseStudiesSection() {
  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Trusted by Innovators
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            See how leading companies leverage NexusSite-AI to accelerate their digital transformation and ship faster.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {caseStudies.map((study, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <Quote size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{study.company}</h3>
                  <p className="text-sm text-gray-500">{study.industry}</p>
                </div>
              </div>
              <blockquote className="text-gray-700 mb-8 leading-relaxed">
                "{study.quote}"
              </blockquote>
              <div className="grid grid-cols-2 gap-4 pt-6 border-t border-gray-100">
                {study.metrics.map((metric, mIndex) => (
                  <div key={mIndex} className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                      <metric.icon size={18} />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-gray-900">{metric.value}</p>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">{metric.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
