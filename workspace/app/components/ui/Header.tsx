import Link from 'next/link';
import { Lucide } from 'lucide-react';

export function Header() {
  return (
    <header className="bg-white py-4">
      <nav className="container mx-auto flex justify-between items-center">
        <Link href="/">
          <a className="text-lg font-bold">NexusSite-AI Demo</a>
        </Link>
        <ul className="flex items-center">
          <li className="mr-6">
            <Link href="#">
              <a className="text-gray-600 hover:text-gray-900">Features</a>
            </Link>
          </li>
          <li className="mr-6">
            <Link href="#">
              <a className="text-gray-600 hover:text-gray-900">Pricing</a>
            </Link>
          </li>
          <li>
            <Link href="#">
              <a className="text-gray-600 hover:text-gray-900">About</a>
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
