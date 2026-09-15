import React from 'react';
import { OrivioLogo } from '../brand/OrivioLogo';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-black border-t border-white/5 pt-16 pb-12 text-xs text-slate-400">
      <div className="max-w-[1440px] mx-auto px-6 sm:px-8 lg:px-12">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 pb-12 border-b border-white/5">
          
          {/* Col 1: Brand & Tagline */}
          <div className="col-span-2 space-y-4">
            <OrivioLogo size={32} />
            
            <div className="space-y-1">
              <p className="text-xs text-slate-400">
                One platform.{' '}
                <span className="text-[#8B5D7E] font-medium">Built</span> for{' '}
                <span className="text-[#FDB02F] font-semibold">Africa.</span>
              </p>
              <p className="text-[11px] text-slate-600 pt-2">
                © {new Date().getFullYear()} Orivio. All rights reserved.
              </p>
            </div>
          </div>

          {/* Col 2: Solutions */}
          <div className="space-y-3">
            <p className="font-bold text-white text-xs">Solutions</p>
            <ul className="space-y-2">
              <li><a href="/products" className="hover:text-white transition">All solutions</a></li>
              <li><a href="/products" className="hover:text-white transition">For SMEs</a></li>
              <li><a href="/products" className="hover:text-white transition">For enterprises</a></li>
              <li><a href="/pricing" className="hover:text-white transition">Pricing</a></li>
            </ul>
          </div>

          {/* Col 3: Industries */}
          <div className="space-y-3">
            <p className="font-bold text-white text-xs">Industries</p>
            <ul className="space-y-2">
              <li><a href="/products" className="hover:text-white transition">Retail</a></li>
              <li><a href="/products" className="hover:text-white transition">Education</a></li>
              <li><a href="/products" className="hover:text-white transition">Healthcare</a></li>
              <li><a href="/products" className="hover:text-white transition">Logistics</a></li>
            </ul>
          </div>

          {/* Col 4: Resources */}
          <div className="space-y-3">
            <p className="font-bold text-white text-xs">Resources</p>
            <ul className="space-y-2">
              <li><a href="#blog" className="hover:text-white transition">Blog</a></li>
              <li><a href="#help" className="hover:text-white transition">Help center</a></li>
              <li><a href="#developers" className="hover:text-white transition">Developers</a></li>
              <li><a href="#partners" className="hover:text-white transition">Partners</a></li>
            </ul>
          </div>

          {/* Col 5: Company & Follow Us */}
          <div className="space-y-3">
            <p className="font-bold text-white text-xs">Company</p>
            <ul className="space-y-2">
              <li><a href="#about" className="hover:text-white transition">About us</a></li>
              <li><a href="#careers" className="hover:text-white transition">Careers</a></li>
              <li><a href="#contact" className="hover:text-white transition">Contact us</a></li>
            </ul>
          </div>

        </div>

        {/* Bottom Social Media Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-[11px] text-slate-500">
            <a href="#privacy" className="hover:text-slate-300 transition">Privacy Policy</a>
            <span>•</span>
            <a href="#terms" className="hover:text-slate-300 transition">Terms of Service</a>
            <span>•</span>
            <a href="#security" className="hover:text-slate-300 transition">Security</a>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold text-slate-300 mr-1">Follow us</span>

            {/* Facebook */}
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Facebook"
              className="w-7 h-7 rounded-sm bg-white/5 hover:bg-[#714B67] text-slate-300 hover:text-white border border-white/10 flex items-center justify-center transition"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
              </svg>
            </a>

            {/* Twitter / X */}
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Twitter"
              className="w-7 h-7 rounded-sm bg-white/5 hover:bg-[#714B67] text-slate-300 hover:text-white border border-white/10 flex items-center justify-center transition"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>

            {/* Instagram */}
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="w-7 h-7 rounded-sm bg-white/5 hover:bg-[#714B67] text-slate-300 hover:text-white border border-white/10 flex items-center justify-center transition"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </a>

            {/* LinkedIn */}
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noreferrer"
              aria-label="LinkedIn"
              className="w-7 h-7 rounded-sm bg-white/5 hover:bg-[#714B67] text-slate-300 hover:text-white border border-white/10 flex items-center justify-center transition"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
