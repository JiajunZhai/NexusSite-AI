'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle, XCircle, Copy, Terminal } from 'lucide-react';

interface TestResult {
  name: string;
  url: string;
  type: string;
  status: 'pass' | 'fail';
  logs: string[];
  timestamp: string;
}

export default function ResultsPage() {
  const [result, setResult] = useState<TestResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('testResult');
    if (stored) {
      try {
        setResult(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse test result', e);
      }
    }
  }, []);

  const copyLogs = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!result) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <Terminal className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-4">No Test Results</h1>
        <p className="text-gray-600 mb-8">
          You haven&apos;t run any tests yet. Configure a test to get started.
        </p>
        <Link
          href="/test"
          className="inline-flex items-center justify-center rounded-md bg-[#7c3aed] px-6 py-3 text-base font-medium text-white shadow hover:bg-[#6d28d9] focus:outline-none focus:ring-2 focus:ring-[#7c3aed] focus:ring-offset-2 transition-colors"
        >
          Run a Test
        </Link>
      </div>
    );
  }

  const isPass = result.status === 'pass';

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Test Results</h1>
        <Link
          href="/test"
          className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#7c3aed] focus:ring-offset-2 transition-colors"
        >
          Run Another Test
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-sm font-medium text-gray-500">Test Name</h2>
            <p className="text-lg font-medium text-gray-900">{result.name}</p>
          </div>
          <div>
            <h2 className="text-sm font-medium text-gray-500">Target URL</h2>
            <p className="text-lg font-medium text-gray-900 break-all">{result.url}</p>
          </div>
          <div>
            <h2 className="text-sm font-medium text-gray-500">Test Type</h2>
            <p className="text-lg font-medium text-gray-900 capitalize">{result.type}</p>
          </div>
          <div>
            <h2 className="text-sm font-medium text-gray-500">Timestamp</h2>
            <p className="text-lg font-medium text-gray-900">
              {new Date(result.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="mt-6 flex items-center">
          <span className="text-sm font-medium text-gray-500 mr-2">Status:</span>
          {isPass ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
              <CheckCircle className="h-4 w-4 mr-1.5" />
              Passed
            </span>
          ) : (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
              <XCircle className="h-4 w-4 mr-1.5" />
              Failed
            </span>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Log Output</h2>
          <button
            onClick={copyLogs}
            className="inline-flex items-center text-sm text-gray-600 hover:text-[#7c3aed] transition-colors"
          >
            {copied ? (
              <>
                <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </>
            )}
          </button>
        </div>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto text-sm font-mono h-96 overflow-y-auto">
          {result.logs.join('\n')}
        </pre>
      </div>
    </div>
  );
}
