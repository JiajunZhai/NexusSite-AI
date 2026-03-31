import { Lucide } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-gray-100 py-8">
      <div className="container mx-auto flex justify-between items-center">
        <p className="text-gray-600">
          &copy; 2023 NexusSite-AI Demo. All rights reserved.
        </p>
        <ul className="flex items-center">
          <li className="mr-6">
            <a
              href="#"
              className="text-gray-600 hover:text-gray-900"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Lucide icon="github" className="mr-2" />
              GitHub
            </a>
          </li>
          <li>
            <a
              href="#"
              className="text-gray-600 hover:text-gray-900"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Lucide icon="twitter" className="mr-2" />
              Twitter
            </a>
          </li>
        </ul>
      </div>
    </footer>
  );
}
