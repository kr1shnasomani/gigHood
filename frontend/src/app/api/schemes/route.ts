import { NextResponse } from 'next/server';

type Scheme = {
  id: number;
  name: string;
  category: string;
  benefit: string;
  detail: string;
  link: string;
  icon: string;
  tags: string[];
};

export async function GET() {
  const schemes: Scheme[] = [
    {
      id: 1,
      name: "e-Shram Card",
      category: "social_security",
      benefit: "₹2,00,000 accident insurance cover",
      detail: "National database for unorganised workers with access to welfare benefits.",
      link: "https://eshram.gov.in",
      icon: "🪪",
      tags: ["accident", "free", "central"],
    },
    {
      id: 2,
      name: "PM Suraksha Bima Yojana",
      category: "insurance",
      benefit: "₹2,00,000 cover at ₹12/year",
      detail: "Accidental death and disability insurance through bank.",
      link: "https://jansuraksha.gov.in",
      icon: "🛡",
      tags: ["cheap", "bank", "central"],
    },
    {
      id: 3,
      name: "PM Jeevan Jyoti Bima Yojana",
      category: "insurance",
      benefit: "₹2,00,000 life cover at ₹436/year",
      detail: "Life insurance covering death from any cause.",
      link: "https://jansuraksha.gov.in",
      icon: "💼",
      tags: ["life", "bank"],
    },
    {
      id: 4,
      name: "PM SVANidhi",
      category: "loan",
      benefit: "Loans up to ₹50,000",
      detail: "Micro-credit scheme for small vendors and gig workers.",
      link: "https://pmsvanidhi.mohua.gov.in",
      icon: "💰",
      tags: ["loan", "vendor"],
    },
    {
      id: 5,
      name: "Ayushman Bharat (PM-JAY)",
      category: "health",
      benefit: "₹5,00,000 hospital cover",
      detail: "Free healthcare coverage for eligible families.",
      link: "https://pmjay.gov.in",
      icon: "🏥",
      tags: ["health", "free"],
    },
    {
      id: 6,
      name: "Tamil Nadu Gig Worker Welfare Fund",
      category: "state",
      benefit: "Education, disability & maternity support",
      detail: "State-level welfare scheme for platform workers.",
      link: "https://labour.tn.gov.in",
      icon: "🌟",
      tags: ["state", "tamil_nadu"],
    },
    {
      id: 7,
      name: "ESIC Voluntary Coverage",
      category: "health",
      benefit: "Medical + sickness benefits",
      detail: "Voluntary ESIC enrollment for gig workers.",
      link: "https://esic.gov.in",
      icon: "🩺",
      tags: ["medical", "voluntary"],
    },
    {
      id: 8,
      name: "Atal Pension Yojana",
      category: "pension",
      benefit: "₹1,000–₹5,000 monthly pension",
      detail: "Retirement pension scheme for unorganised workers.",
      link: "https://www.npscra.nsdl.co.in",
      icon: "👴",
      tags: ["pension", "retirement"],
    },
    {
      id: 9,
      name: "National Digital Health Mission",
      category: "health",
      benefit: "Digital health ID & records",
      detail: "Central health identity for easier medical access.",
      link: "https://ndhm.gov.in",
      icon: "📱",
      tags: ["health", "digital"],
    }
  ];

  return NextResponse.json(schemes);
}
