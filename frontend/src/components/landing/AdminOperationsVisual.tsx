'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Calculator, Hexagon, Network, ArrowRight } from 'lucide-react';

export function AdminOperationsVisual() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-8% 0px' });

  return (
    <section ref={sectionRef} id="admin-operations" className="project-section project-architecture">
      <div className="project-architecture-shell">
        <motion.div
          className="project-section-head"
          initial={{ opacity: 0, y: 28 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2>Enterprise Operations & Actuarial Dashboard</h2>
          <a href="#admin-operations" className="project-link-primary project-inline-cta">
            Mathematically Solvent <ArrowRight size={15} />
          </a>
        </motion.div>
        
        <motion.p
          className="project-section-lead"
          initial={{ opacity: 0, y: 28 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          gigHood is a mathematically sound, production-ready platform. We back our parametric 
          triggers with strict actuarial solvency, hyper-local telemetry, and enterprise-grade 
          fraud defense—all monitored live via the Admin Dashboard.
        </motion.p>

        <div className="project-arch-grid">
          
          {/* Block 1: BCR */}
          <motion.article
            className="project-arch-card"
            initial={{ opacity: 0, y: 24 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.65, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="project-arch-visual tone-cyan">
              <div className="project-arch-icon-wrap">
                <Calculator size={78} />
              </div>
              <div className="project-arch-badge">
                <Calculator size={16} />
                <p>Actuarial Solvency</p>
              </div>
            </div>
            <div className="project-arch-copy">
              <h3>Mathematically Solvent Underwriting</h3>
              <p>
                Our platform targets a strict <strong>0.65 BCR</strong>. For every ₹1.00 collected, exactly ₹0.65 is mathematically reserved for automated payouts.
              </p>
            </div>
          </motion.article>

          {/* Block 2: H3 Hex Grid */}
          <motion.article
            className="project-arch-card"
            initial={{ opacity: 0, y: 24 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.65, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="project-arch-visual tone-amber">
              <div className="project-arch-icon-wrap">
                <Hexagon size={78} />
              </div>
              <div className="project-arch-badge">
                <Hexagon size={16} />
                <p>H3 Hex Grid</p>
              </div>
            </div>
            <div className="project-arch-copy">
              <h3>Hyper-Local Disruption Mapping</h3>
              <p>
                We eliminate basis risk by utilizing Uber’s H3 spatial indexing at Resolution 9. Monitor risk across 1.2km municipal wards in real time.
              </p>
            </div>
          </motion.article>

          {/* Block 3: Neo4j */}
          <motion.article
            className="project-arch-card"
            initial={{ opacity: 0, y: 24 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.65, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="project-arch-visual tone-indigo">
              <div className="project-arch-icon-wrap">
                <Network size={78} />
              </div>
              <div className="project-arch-badge">
                <Network size={16} />
                <p>Neo4j Defense</p>
              </div>
            </div>
            <div className="project-arch-copy">
              <h3>Visualizing &quot;Sybil Scatter&quot; Syndicates</h3>
              <p>
                A 7-layer defense architecture maps relationships across Worker → Device → H3 Zone. Automatically traps coordinated GPS spoofer attacks.
              </p>
            </div>
          </motion.article>

        </div>
      </div>
    </section>
  );
}
