'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Loader2 } from 'lucide-react';

export default function TestPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState('smoke');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Simulate test execution delay
    setTimeout(() => {
      // Generate random result (70% pass)
      const passed = Math.random() > 0.3;
      const logs = generateLogs(url, type, passed);
      const result = {
        name: name || 'Untitled Test',
        url,
        type,
        status: passed ? 'pass' : 'fail',
        logs,
        timestamp: new Date().toISOString(),
      };
      // Store in sessionStorage
      sessionStorage.setItem('testResult', JSON.stringify(result));
      // Redirect to results
      router.push('/results');
    }, 1000);
  };

  function generateLogs(url: string, type: string, passed: boolean): string[] {
    const lines: string[] = [];
    lines.push(`[INFO] Starting test: ${type} on ${url}`);
    lines.push(`[INFO] Initializing browser...`);
    lines.push(`[INFO] Navigating to ${url}...`);
    lines.push(`[INFO] Page loaded. Starting checks...`);
    // Simulate some checks
    const checks = [
      'Checking page title',
      'Verifying navigation bar',
      'Testing form submission',
      'Validating responsive layout',
      'Checking console errors',
    ];
    checks.forEach((check, i) => {
      const success = passed || Math.random() > 0.3; // if overall pass, most checks pass
      lines.push(`[${success ? 'PASS' : 'FAIL'}] ${check}`);
    });
    lines.push(`[INFO] Test completed. Status: ${passed ? 'PASSED' : 'FAILED'}`);
    return lines;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Configure Test</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Test Name (optional)
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed] focus:border-transparent"
            placeholder="My UI Test"
          />
        </div>
        <div>
          <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
            Target URL <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed] focus:border-transparent"
            placeholder="https://example.com"
          />
        </div>
        <div>
          <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
            Test Type
          </label>
          <select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed] focus:border-transparent"
          >
            <option value="smoke">Smoke Test</option>
            <option value="regression">Regression Test</option>
            <option value="full">Full Suite</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md bg-[#7c3aed] px-6 py-3 text-base font-medium text-white shadow hover:bg-[#6d28d9] focus:outline-none focus:ring-2 focus:ring-[#7c3aed] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="mr-2 h-5 w-5" />
              Run Test
            </>
          )}
        </button>
      </form>
    </div>
  );
}
