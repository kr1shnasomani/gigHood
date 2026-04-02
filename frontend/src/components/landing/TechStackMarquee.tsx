'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  SiDocker,
  SiFastapi,
  SiPython,
  SiReact,
  SiSupabase,
  SiTailwindcss,
} from '@icons-pack/react-simple-icons';

const techStack = [
  {
    name: 'OpenRouter',
    logo: (
      <Image
        src="/tech/openrouter-logo.png"
        alt="OpenRouter logo"
        width={28}
        height={28}
        className="project-tech-icon-image"
      />
    ),
  },
  {
    name: 'Qdrant',
    logo: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 57 64" className="project-tech-icon-svg">
        <g clipPath="url(#qdrant-clip)">
          <path fill="#dc244c" d="M28.335 0 .62 16v32l27.714 16 10.392-6V46l-10.392 6-17.32-10V22l17.32-10 17.32 10v40l10.393-6V16z"/>
          <path fill="#dc244c" d="M17.943 26v12l10.392 6 10.392-6V26l-10.392-6z"/>
          <path fill="#bd0c3e" d="M38.727 46v12l-10.392 6V52zm17.321-30v40l-10.393 6V22z"/>
          <path fill="#ff516b" d="m56.048 16-10.393 6-17.32-10-17.32 10L.62 16 28.335 0z"/>
          <path fill="#dc244c" d="M28.335 52v12L.62 48V16l10.394 6v20z"/>
          <path fill="#ff516b" d="m38.727 26-10.392 6-10.392-6 10.392-6z"/>
          <path fill="#dc244c" d="M28.335 32v12l-10.392-6V26z"/>
          <path fill="#bd0c3e" d="M38.727 26v12l-10.392 6V32z"/>
        </g>
        <defs>
          <clipPath id="qdrant-clip">
            <path fill="#fff" d="M.332 0h56v64h-56z"/>
          </clipPath>
        </defs>
      </svg>
    ),
  },
  {
    name: 'Supabase',
    logo: <SiSupabase size={28} color="#3ECF8E" />,
  },
  {
    name: 'Jina',
    logo: (
      <Image
        src="/tech/jina-logo.png"
        alt="Jina logo"
        width={28}
        height={28}
        className="project-tech-icon-image project-tech-icon-image-jina"
      />
    ),
  },
  {
    name: 'React',
    logo: <SiReact size={28} color="#61dafb" />,
  },
  {
    name: 'FastAPI',
    logo: <SiFastapi size={28} color="#009688" />,
  },
  {
    name: 'Python',
    logo: <SiPython size={28} color="#3776AB" />,
  },
  {
    name: 'Tailwind CSS',
    logo: <SiTailwindcss size={28} color="#38bdf8" />,
  },
  {
    name: 'Docker',
    logo: <SiDocker size={28} color="#2496ED" />,
  },
];

export function TechStackMarquee() {
  return (
    <section className="project-tech-marquee">
      <div className="project-tech-header">
        <span className="project-tech-label">Powered by industry leaders and state-of-the-art open source</span>
      </div>

      <div className="project-tech-carousel">
        <div className="project-tech-fade-left" />
        <div className="project-tech-fade-right" />

        <div className="project-tech-inner-track">
          <motion.div
            className="project-tech-motion-track"
            animate={{ x: '-50%' }}
            transition={{ repeat: Infinity, ease: 'linear', duration: 36 }}
          >
            {[...techStack, ...techStack].map((tech, idx) => (
              <div key={`${tech.name}-${idx}`} className="project-tech-item">
                <div className="project-tech-icon-shell">{tech.logo}</div>
                <span>{tech.name}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
