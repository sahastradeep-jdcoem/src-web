import { EventItem } from "@/types";

export const defaultPrarambhEvent: EventItem = {
  id: "evt-prarambh",
  slug: "prarambh",
  name: "PRARAMBH",
  tagline: "The Inception of Sahastradeep",
  category: "Fest",
  date: "Annual Flagship Fest",
  time: "Full Day Collegiate Showcase",
  venue: "JDCOEM Central Campus, Nagpur",
  organizer: "SRC JDCOEM",
  organizerClubSlug: "event",
  status: "Registration Open",
  isFeatured: true,
  poster: "https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=1600&auto=format&fit=crop",
  description: "The flagship annual foundation and cultural extravaganza of JDCOEM Nagpur. Uniting all student bodies, departments, and clubs under the banner of Sahastradeep.",
  about: "Prarambh marks the premier collegiate festival and council inception hosted by the Student Representative Council (Sahastradeep). Bringing together students across engineering, technology, and management departments to compete, perform, and celebrate institutional excellence.",
  whatToExpect: [
    "Grand Stage Showcases, Cultural Performances & Band Showdowns",
    "Inter-Department Championships & Technical Competitions",
    "Club Charters, Exhibits, and Creative Arenas",
    "Official Accreditation and Verified Digital Delegate Passes"
  ],
  rules: [
    "All participants must carry their official College ID along with the digital SRC Ticket QR.",
    "Department delegations must be accredited through the SRC portal.",
    "Fair play and respectful collegiate conduct are mandatory across all arenas."
  ],
  schedule: [
    {
      time: "Morning • 10:00 AM",
      title: "Grand Inauguration & Sahastradeep Lamp Lighting",
      description: "Official opening ceremony with dignitaries, council investiture, and cultural prologue.",
      venue: "Central Amphitheatre"
    },
    {
      time: "Afternoon • 01:30 PM",
      title: "Technical, Cultural & Department Showcases",
      description: "Competitions, club arenas, and inter-department showcases across campus.",
      venue: "Main Quadrangle & Stages"
    },
    {
      time: "Evening • 06:00 PM",
      title: "Awards Gala & Headline Concert",
      description: "Felicitation ceremony and headline evening performances.",
      venue: "JDCOEM Central Grounds"
    }
  ],
  prizes: [
    {
      position: "Winner (Overall Championship)",
      amount: "Championship Shield",
      perks: ["Sahastradeep Championship Shield", "Gold Medals", "Official Institutional Citations"]
    },
    {
      position: "Runner Up",
      amount: "Silver Trophy & Accreditations",
      perks: ["Silver Trophy", "Merit Citations"]
    }
  ],
  teamType: "Both",
  minTeamSize: 1,
  maxTeamSize: 10,
  registrationDeadline: "Open for Registrations",
  entryFee: "Free for JDCOEM Students",
  coordinatorContact: {
    name: "SRC Secretariat Desk",
    role: "Central Student Council",
    phone: "srcjdcoem@gmail.com"
  }
};

export const bollywoodDayEvent: EventItem = {
  id: "evt-1789248106702-8me7",
  slug: "bollywood-day",
  name: "Bollywood Day",
  tagline: "Relive the Magic, Drama & Glamour of Indian Cinema",
  category: "Cultural",
  date: "18 September 2026",
  rawDate: "2026-09-18",
  time: "11:00 AM - 04:00 PM",
  venue: "Main Auditorium, JDCOEM",
  organizer: "SRC JDCOEM",
  organizerClubSlug: "cultural",
  status: "Registration Open",
  isLive: true,
  isFeatured: true,
  isInterCollege: true,
  targetAudience: "inter_college",
  poster: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1600&auto=format&fit=crop",
  cardImage: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1600&auto=format&fit=crop",
  description: "Celebrate the vibrant colors, iconic dialogues, and unforgettable music of Indian cinema in this college-wide Bollywood showcase.",
  about: "Bollywood Day invites students from JDCOEM and accredited colleges to showcase their flair for music, dance, dramatic monologues, and iconic costume tributes. Join us for a day of pure cinematic celebration.",
  whatToExpect: [
    "Iconic Bollywood Costume Parade & Ramp Walk",
    "Solo & Group Dance Face-Offs",
    "Retro & Modern Soundtrack Performances",
    "Digital Delegate Badges and Spot Prizes"
  ],
  rules: [
    "Costumes and musical selections must adhere to collegiate decency standards.",
    "Bring official College ID along with the SRC Ticket QR pass.",
    "Reporting time: 30 minutes before the scheduled stage slot."
  ],
  schedule: [
    {
      time: "11:00 AM",
      title: "Inauguration & Cinematic Welcome",
      description: "Opening medley performance by SRC Cultural Club.",
      venue: "Main Auditorium"
    },
    {
      time: "12:30 PM",
      title: "Costume Walk & Monologue Competitions",
      description: "Student character showcases and spotlight performances.",
      venue: "Main Stage"
    },
    {
      time: "03:00 PM",
      title: "Grand Finale & Prize Distribution",
      description: "Announcement of Best Dressed, Top Performers, and Trophies.",
      venue: "Main Stage"
    }
  ],
  prizes: [
    {
      position: "Best Dressed & Spotlight Award",
      amount: "Trophy & Accreditations",
      perks: ["Official Institutional Trophy", "Merit Certificate"]
    }
  ],
  teamType: "Both",
  minTeamSize: 1,
  maxTeamSize: 4,
  entryFee: "₹1",
  isPaid: true,
  feeAmount: 1,
  feePricingModel: "per_person",
  registrationDeadline: "17 September 2026",
  coordinatorContact: {
    name: "SRC Cultural Secretariat",
    role: "Lead Coordinator",
    phone: "8237981028"
  }
};

export const codeAlphaEvent: EventItem = {
  id: "evt-1789231618523-hfyv",
  slug: "codealpha",
  name: "CodeAlpha",
  tagline: "The Premier Collegiate Algorithmic Coding Challenge",
  category: "Technical",
  date: "19 September 2026",
  rawDate: "2026-09-19",
  time: "10:00 AM - 01:00 PM",
  venue: "Central Computing Complex (Lab 3 & 4), JDCOEM",
  organizer: "SRC JDCOEM",
  organizerClubSlug: "code",
  status: "Registration Open",
  isLive: true,
  isFeatured: true,
  isInterCollege: true,
  targetAudience: "inter_college",
  poster: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1600&auto=format&fit=crop",
  cardImage: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1600&auto=format&fit=crop",
  description: "Battle against top collegiate programmers in intense algorithmic problem solving, data structures, and speed coding rounds.",
  about: "CodeAlpha tests your computational thinking, algorithmic efficiency, and debugging speed. Open to both individual coders and duos across all undergraduate programs.",
  whatToExpect: [
    "Competitive Coding with Live Leaderboards",
    "Dynamic Problem Sets spanning Arrays, Trees, DP & Graphs",
    "Automated Test Case Evaluation",
    "Recognized Merit Citations for Top Rankers"
  ],
  rules: [
    "All code submissions will run through automated plagiarism and similarity checkers.",
    "Supported languages: C++, Java, Python, and JavaScript.",
    "Participants must bring valid institutional photo ID."
  ],
  schedule: [
    {
      time: "10:00 AM",
      title: "System Setup & Platform Briefing",
      description: "Distribution of credentials and warm-up trial run.",
      venue: "Lab 3 & 4"
    },
    {
      time: "10:30 AM",
      title: "Sprint Round (Algorithmic Problems)",
      description: "Two hours of intense live coding problems.",
      venue: "Computing Complex"
    },
    {
      time: "12:45 PM",
      title: "Leaderboard Freeze & Winner Announcement",
      description: "Presentation of winners and code review breakdown.",
      venue: "Seminar Hall 1"
    }
  ],
  prizes: [
    {
      position: "1st Place Winner",
      amount: "₹1,000 & Winner Trophy",
      perks: ["First Place Winner Shield", "Certificate of Excellence"]
    },
    {
      position: "Runner Up",
      amount: "₹500 & Medal",
      perks: ["Runner Up Medal", "Certificate of Merit"]
    }
  ],
  teamType: "Both",
  minTeamSize: 1,
  maxTeamSize: 2,
  entryFee: "₹10",
  isPaid: true,
  feeAmount: 10,
  feePricingModel: "per_person",
  registrationDeadline: "18 September 2026",
  coordinatorContact: {
    name: "SRC Tech Council",
    role: "Technical Lead",
    phone: "8237981028"
  }
};

export const testingEvent: EventItem = {
  id: "evt-1789295005208-ba76",
  slug: "testing",
  name: "Testing",
  tagline: "Live Software Quality Assurance & Bug Hunt Challenge",
  category: "Technical",
  date: "20 September 2026",
  rawDate: "2026-09-20",
  time: "02:00 PM - 04:30 PM",
  venue: "Lab 2, Central Computing Center, JDCOEM",
  organizer: "SRC JDCOEM",
  organizerClubSlug: "tech",
  status: "Registration Open",
  isLive: true,
  isFeatured: false,
  poster: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1600&auto=format&fit=crop",
  cardImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1600&auto=format&fit=crop",
  description: "Hands-on software testing arena focusing on unit testing, automation suites, security edge-cases, and bug reporting.",
  about: "Put your QA skills to the test in this interactive software testing and vulnerability discovery challenge. Find hidden edge cases, verify regression tests, and write robust assertion suites.",
  whatToExpect: [
    "Real-World Web App Bug Hunting",
    "Automated Assertion & Unit Test Writing",
    "Security & Boundary Condition Stress Testing",
    "Immediate Verification and Feedback"
  ],
  rules: [
    "Use provided test environments and mock credentials.",
    "Bugs must be logged with reproducible steps and screenshots.",
    "Individual participation only."
  ],
  schedule: [
    {
      time: "02:00 PM",
      title: "Environment Walkthrough & Scope",
      description: "Briefing on target web application and test targets.",
      venue: "Lab 2"
    },
    {
      time: "02:30 PM",
      title: "Live Bug Hunt & QA Sprint",
      description: "Find, report, and automate test cases.",
      venue: "Lab 2"
    },
    {
      time: "04:15 PM",
      title: "Evaluation & Certificates",
      description: "Scoring of verified bugs and QA submissions.",
      venue: "Lab 2"
    }
  ],
  prizes: [
    {
      position: "Top QA Hunter",
      amount: "Winner Citation",
      perks: ["Top Bug Hunter Certificate", "Accreditation Badge"]
    }
  ],
  teamType: "Individual",
  minTeamSize: 1,
  maxTeamSize: 1,
  entryFee: "₹1.02",
  isPaid: true,
  feeAmount: 1.02,
  feePricingModel: "per_person",
  registrationDeadline: "20 September 2026",
  coordinatorContact: {
    name: "Harsh Shende",
    role: "QA Lead",
    phone: "8237981028"
  }
};

export const workshopEvent: EventItem = {
  id: "evt-1789288760491-2sih",
  slug: "workshop",
  name: "Workshop",
  tagline: "Hands-on Technical Masterclass & Development Bootcamp",
  category: "Workshops",
  date: "21 September 2026",
  rawDate: "2026-09-21",
  time: "10:30 AM - 03:30 PM",
  venue: "Seminar Hall 2, JDCOEM Campus",
  organizer: "SRC JDCOEM",
  organizerClubSlug: "event",
  status: "Registration Open",
  isLive: true,
  isFeatured: false,
  poster: "https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=1600&auto=format&fit=crop",
  cardImage: "https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=1600&auto=format&fit=crop",
  description: "An intensive, practical hands-on workshop guiding students through modern full-stack web engineering, cloud deployment, and system architecture.",
  about: "Designed for ambitious engineering students looking to elevate their practical skillset. Build, debug, and deploy a live project with mentorship from council tech leads.",
  whatToExpect: [
    "Guided Step-by-Step Architecture Walkthrough",
    "Live Cloud Deployment and Tooling Setup",
    "Interactive Q&A and Mentorship",
    "Official Verified Participation Credential"
  ],
  rules: [
    "Bring your personal laptop and charger.",
    "Pre-requisite tools: Git, Node.js, and VS Code pre-installed.",
    "Active participation is required for certification."
  ],
  schedule: [
    {
      time: "10:30 AM",
      title: "Kickoff & Core Architecture Overview",
      description: "Introduction to production-grade architecture patterns.",
      venue: "Seminar Hall 2"
    },
    {
      time: "01:00 PM",
      title: "Hands-on Lab & Implementation",
      description: "Guided coding session and feature building.",
      venue: "Seminar Hall 2"
    },
    {
      time: "03:00 PM",
      title: "Deployment & Certificate Distribution",
      description: "Live launch verification and distribution of credentials.",
      venue: "Seminar Hall 2"
    }
  ],
  prizes: [
    {
      position: "Verified Participant",
      amount: "Official Certification",
      perks: ["SRC JDCOEM Certificate of Participation"]
    }
  ],
  teamType: "Individual",
  minTeamSize: 1,
  maxTeamSize: 1,
  entryFee: "₹2",
  isPaid: true,
  feeAmount: 2,
  feePricingModel: "per_person",
  registrationDeadline: "20 September 2026",
  coordinatorContact: {
    name: "SRC Workshop Coordinator",
    role: "Coordinator",
    phone: "8237981028"
  }
};

export const authenticEvents: EventItem[] = [
  defaultPrarambhEvent,
  bollywoodDayEvent,
  codeAlphaEvent,
  testingEvent,
  workshopEvent
];

export const mockEvents: EventItem[] = authenticEvents;
